"use server"

import { db } from "@/lib/db"
import { risk, correctiveAction, recordEvent, appNotification } from "@/lib/db/schema"
import { and, desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { assertWritable, requireModuleScope, requireUser, isOrgManager } from "@/lib/session"
import { saveDataUrlAttachment } from "@/lib/attachments-server"
import { residualScore, riskScore, RISK_CLOSE_THRESHOLD } from "@/lib/risk-lifecycle"

// الوجهة التي يستقبل عندها مدير السلامة إشعارات التحقق.
const SAFETY_TARGET = "risks"

function revalidateAll() {
  revalidatePath("/risks")
  revalidatePath("/actions")
  revalidatePath("/")
}

async function logEvent(input: {
  organizationId: string
  recordId: number
  event: string
  fromStatus?: string
  toStatus?: string
  userId?: string
  userName?: string
  note?: string
  meta?: Record<string, unknown>
}) {
  await db.insert(recordEvent).values({
    organizationId: input.organizationId,
    module: "risks",
    recordId: input.recordId,
    event: input.event,
    fromStatus: input.fromStatus ?? "",
    toStatus: input.toStatus ?? "",
    userId: input.userId ?? "",
    userName: input.userName ?? "",
    note: input.note ?? "",
    meta: input.meta ? JSON.stringify(input.meta) : "",
  })
}

async function loadRisk(id: number, organizationId: string) {
  const [row] = await db
    .select()
    .from(risk)
    .where(and(eq(risk.id, id), eq(risk.organizationId, organizationId)))
    .limit(1)
  if (!row) throw new Error("الخطر غير موجود")
  return row
}

// الإجراءات التصحيحية المرتبطة بخطر معيّن (على مستوى المؤسسة).
export async function getRiskActions(riskId: number) {
  const scope = await requireModuleScope("risks")
  return db
    .select()
    .from(correctiveAction)
    .where(and(eq(correctiveAction.organizationId, scope.organizationId), eq(correctiveAction.riskId, riskId)))
    .orderBy(desc(correctiveAction.createdAt))
}

// عدّاد الضوابط المنفّذة لكل خطر: { riskId: { total, completed } }.
export async function getRiskActionCounts(): Promise<Record<number, { total: number; completed: number }>> {
  const scope = await requireModuleScope("risks")
  const rows = await db
    .select({
      riskId: correctiveAction.riskId,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`sum(case when ${correctiveAction.status} = 'completed' then 1 else 0 end)::int`,
    })
    .from(correctiveAction)
    .where(and(eq(correctiveAction.organizationId, scope.organizationId), sql`${correctiveAction.riskId} is not null`))
    .groupBy(correctiveAction.riskId)

  const out: Record<number, { total: number; completed: number }> = {}
  for (const r of rows) {
    if (r.riskId != null) out[r.riskId] = { total: Number(r.total), completed: Number(r.completed) }
  }
  return out
}

/* ---------------- 1) التحويل: إنشاء إجراء تصحيحي من الضوابط المقترحة ---------------- */

export async function referRiskControls(input: {
  riskId: number
  proposedControls: string
  assignedTo?: string
  dueDate?: string | null
}) {
  await assertWritable()
  const u = await requireUser()
  const scope = await requireModuleScope("risks")
  const proposed = input.proposedControls.trim()
  if (!proposed) throw new Error("الضوابط المقترحة إلزامية عند التحويل")

  const row = await loadRisk(input.riskId, scope.organizationId)
  const from = row.status ?? "open"
  if (from === "closed") throw new Error("الخطر مغلق — لا يمكن تحويله")

  await db
    .update(risk)
    .set({ proposedControls: proposed, status: "in_progress" })
    .where(and(eq(risk.id, input.riskId), eq(risk.organizationId, scope.organizationId)))

  // إجراء تصحيحي مرتبط بالخطر.
  await db.insert(correctiveAction).values({
    userId: u.id,
    organizationId: scope.organizationId,
    title: proposed,
    source: `الخطر: ${row.hazard}`,
    assignedTo: input.assignedTo ?? row.owner ?? "",
    priority: "high",
    status: "open",
    dueDate: input.dueDate || null,
    riskId: input.riskId,
  })

  await logEvent({
    organizationId: scope.organizationId,
    recordId: input.riskId,
    event: "control_referred",
    fromStatus: from,
    toStatus: "in_progress",
    userId: u.id,
    userName: u.name,
    note: proposed,
  })
  revalidateAll()
}

// إجراء تصحيحي إضافي لخطر يحتاج ضوابط أكثر (يبقى قيد المعالجة).
export async function createFollowUpAction(input: {
  riskId: number
  title: string
  assignedTo?: string
  dueDate?: string | null
}) {
  await assertWritable()
  const u = await requireUser()
  const scope = await requireModuleScope("risks")
  const title = input.title.trim()
  if (!title) throw new Error("عنوان الإجراء إلزامي")
  const row = await loadRisk(input.riskId, scope.organizationId)
  if (row.status === "closed") throw new Error("الخطر مغلق")

  await db.insert(correctiveAction).values({
    userId: u.id,
    organizationId: scope.organizationId,
    title,
    source: `الخطر: ${row.hazard}`,
    assignedTo: input.assignedTo ?? row.owner ?? "",
    priority: "high",
    status: "open",
    dueDate: input.dueDate || null,
    riskId: input.riskId,
  })

  // إعادة الخطر إلى قيد المعالجة إن كان في التحقق (احتاج ضوابط إضافية).
  await db
    .update(risk)
    .set({ status: "in_progress" })
    .where(and(eq(risk.id, input.riskId), eq(risk.organizationId, scope.organizationId)))

  await logEvent({
    organizationId: scope.organizationId,
    recordId: input.riskId,
    event: "control_referred",
    toStatus: "in_progress",
    userId: u.id,
    userName: u.name,
    note: title,
  })
  revalidateAll()
}

/* ---------------- 2) إتمام الإجراء التصحيحي + الأتمتة ---------------- */

export async function completeCorrectiveAction(input: {
  actionId: number
  implementedControls: string
  evidenceDataUrl?: string
}) {
  await assertWritable()
  const u = await requireUser()
  const scope = await requireModuleScope("actions")
  const implemented = input.implementedControls.trim()
  if (!implemented) throw new Error("الضوابط المنفّذة إلزامية")
  if (!input.evidenceDataUrl?.startsWith("data:")) throw new Error("مرفق الدليل إلزامي لإتمام الإجراء")

  const [action] = await db
    .select()
    .from(correctiveAction)
    .where(and(eq(correctiveAction.id, input.actionId), eq(correctiveAction.organizationId, scope.organizationId)))
    .limit(1)
  if (!action) throw new Error("الإجراء غير موجود")

  // حفظ مرفق الدليل.
  let evidenceUrl = ""
  try {
    const saved = await saveDataUrlAttachment(
      u.id,
      scope.organizationId,
      "actions",
      input.actionId,
      "risk_control_evidence",
      input.evidenceDataUrl,
      `control-evidence-${Date.now()}`,
    )
    evidenceUrl = (saved as { url?: string } | undefined)?.url ?? ""
  } catch {
    throw new Error("تعذّر حفظ مرفق الدليل")
  }
  if (!evidenceUrl) throw new Error("تعذّر حفظ مرفق الدليل")

  await db
    .update(correctiveAction)
    .set({ status: "completed", implementedControls: implemented, evidenceUrl })
    .where(and(eq(correctiveAction.id, input.actionId), eq(correctiveAction.organizationId, scope.organizationId)))

  // أتمتة الخطر المرتبط.
  if (action.riskId != null) {
    await syncRiskAfterActionChange(action.riskId, scope.organizationId, u)
  }
  revalidateAll()
}

// يُعيد حساب حالة الخطر بعد أي تغيّر في إجراءاته المرتبطة.
async function syncRiskAfterActionChange(
  riskId: number,
  organizationId: string,
  u: { id: string; name: string },
) {
  const linked = await db
    .select()
    .from(correctiveAction)
    .where(and(eq(correctiveAction.organizationId, organizationId), eq(correctiveAction.riskId, riskId)))
  if (linked.length === 0) return

  const completed = linked.filter((a) => a.status === "completed")
  const allDone = completed.length === linked.length

  // تجميع الضوابط المنفّذة من كل الإجراءات المكتملة.
  const merged = completed
    .map((a) => (a.implementedControls ?? "").trim())
    .filter(Boolean)
    .join(" • ")

  const [row] = await db
    .select()
    .from(risk)
    .where(and(eq(risk.id, riskId), eq(risk.organizationId, organizationId)))
    .limit(1)
  if (!row) return

  if (allDone && row.status !== "closed") {
    await db
      .update(risk)
      .set({ status: "verification", implementedControls: merged })
      .where(and(eq(risk.id, riskId), eq(risk.organizationId, organizationId)))

    await logEvent({
      organizationId,
      recordId: riskId,
      event: "ready_for_verification",
      fromStatus: row.status ?? "in_progress",
      toStatus: "verification",
      userId: u.id,
      userName: u.name,
    })

    // إشعار مدير السلامة بأن الخطر جاهز للتحقق.
    await db.insert(appNotification).values({
      organizationId,
      targetModule: SAFETY_TARGET,
      module: "risks",
      recordId: riskId,
      title: `خطر جاهز للتحقق: ${row.hazard}`,
      message: "اكتملت جميع الضوابط المنفّذة. يلزم إعادة التقييم والتوقيع للإغلاق.",
    })
  } else if (merged) {
    // تحديث الضوابط المنفّذة تدريجياً حتى قبل اكتمال الجميع.
    await db
      .update(risk)
      .set({ implementedControls: merged })
      .where(and(eq(risk.id, riskId), eq(risk.organizationId, organizationId)))
  }
}

/* ---------------- 3) إعادة التقييم ---------------- */

export async function reassessRisk(input: {
  riskId: number
  residualLikelihood: number
  residualConsequence: number
}) {
  await assertWritable()
  const u = await requireUser()
  const scope = await requireModuleScope("risks")
  const rl = Math.round(input.residualLikelihood)
  const rc = Math.round(input.residualConsequence)
  if (rl < 1 || rl > 5 || rc < 1 || rc > 5) throw new Error("القيم يجب أن تكون بين 1 و5")

  const row = await loadRisk(input.riskId, scope.organizationId)
  if (row.status !== "verification") throw new Error("إعادة التقييم متاحة في مرحلة التحقق فقط")

  await db
    .update(risk)
    .set({ residualLikelihood: rl, residualConsequence: rc })
    .where(and(eq(risk.id, input.riskId), eq(risk.organizationId, scope.organizationId)))

  const before = riskScore(row.likelihood, row.consequence)
  const after = rl * rc
  await logEvent({
    organizationId: scope.organizationId,
    recordId: input.riskId,
    event: "reassessed",
    userId: u.id,
    userName: u.name,
    note: `${before} → ${after}`,
    meta: { before, after, residualLikelihood: rl, residualConsequence: rc },
  })
  revalidateAll()
}

/* ---------------- 4) الإغلاق بتوقيع مدير السلامة ---------------- */

export async function closeRiskWithSignature(input: { riskId: number; signatureDataUrl: string }) {
  await assertWritable()
  const u = await requireUser()
  const scope = await requireModuleScope("risks")
  if (!isOrgManager(u)) throw new Error("توقيع الإغلاق متاح لمدير السلامة (مدير/أدمن) فقط")
  if (!input.signatureDataUrl?.startsWith("data:")) throw new Error("توقيع مدير السلامة إلزامي للإغلاق")

  const row = await loadRisk(input.riskId, scope.organizationId)
  if (row.status !== "verification") throw new Error("لا يمكن الإغلاق إلا من مرحلة التحقق")

  const after = residualScore(row)
  if (!(row.residualLikelihood != null && row.residualConsequence != null)) {
    throw new Error("يجب إعادة التقييم قبل الإغلاق")
  }
  if (after >= RISK_CLOSE_THRESHOLD) {
    throw new Error("الدرجة المتبقية ما زالت مرتفعة — أضف ضوابط إضافية")
  }

  // حفظ التوقيع كمرفق.
  let signatureUrl = ""
  try {
    const saved = await saveDataUrlAttachment(
      u.id,
      scope.organizationId,
      "risks",
      input.riskId,
      "risk_closure_signature",
      input.signatureDataUrl,
      `risk-closure-signature-${Date.now()}`,
    )
    signatureUrl = (saved as { url?: string } | undefined)?.url ?? ""
  } catch {
    throw new Error("تعذّر حفظ التوقيع")
  }
  if (!signatureUrl) throw new Error("تعذّر حفظ التوقيع")

  const now = new Date()
  // تاريخ المراجعة القادمة: بعد سنة من الإغلاق.
  const nextReview = new Date(now)
  nextReview.setFullYear(nextReview.getFullYear() + 1)
  const nextReviewStr = nextReview.toISOString().slice(0, 10)

  // نقل الضوابط المنفّذة لتصبح هي الضوابط القائمة (الحالية).
  const newExisting = [row.controls, row.implementedControls]
    .map((c) => (c ?? "").trim())
    .filter(Boolean)
    .join(" • ")

  await db
    .update(risk)
    .set({
      status: "closed",
      controls: newExisting || row.controls,
      closureSignatureUrl: signatureUrl,
      closedBy: u.name,
      closedAt: now,
      reviewDate: nextReviewStr,
    })
    .where(and(eq(risk.id, input.riskId), eq(risk.organizationId, scope.organizationId)))

  // رفع أوامر التحكم المرتبطة: إغلاق الإجراءات التصحيحية المرتبطة تلقائياً.
  await db
    .update(correctiveAction)
    .set({ status: "closed" })
    .where(
      and(
        eq(correctiveAction.organizationId, scope.organizationId),
        eq(correctiveAction.riskId, input.riskId),
      ),
    )

  await logEvent({
    organizationId: scope.organizationId,
    recordId: input.riskId,
    event: "closed",
    fromStatus: "verification",
    toStatus: "closed",
    userId: u.id,
    userName: u.name,
    note: `الدرجة المتبقية ${after} — مراجعة قادمة ${nextReviewStr}`,
  })

  // وسم إشعار التحقق كمقروء.
  await db
    .update(appNotification)
    .set({ read: true })
    .where(
      and(
        eq(appNotification.organizationId, scope.organizationId),
        eq(appNotification.targetModule, SAFETY_TARGET),
        eq(appNotification.recordId, input.riskId),
      ),
    )
  revalidateAll()
}

// إشعارات مدير السلامة (الأخطار الجاهزة للتحقق) غير المقروءة.
export async function getRiskVerificationNotifications() {
  const scope = await requireModuleScope("risks")
  return db
    .select()
    .from(appNotification)
    .where(
      and(
        eq(appNotification.organizationId, scope.organizationId),
        eq(appNotification.targetModule, SAFETY_TARGET),
        eq(appNotification.read, false),
      ),
    )
    .orderBy(desc(appNotification.createdAt))
    .limit(50)
}
