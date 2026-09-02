"use server"

import { db } from "@/lib/db"
import { violation, incident, recordEvent, appNotification } from "@/lib/db/schema"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { assertWritable, requireModuleScope, requireScope, requireUser } from "@/lib/session"
import { saveDataUrlAttachment } from "@/lib/attachments-server"
import {
  canTransition,
  normalizeLifecycle,
  type Dept,
  type LifecycleEvent,
  type LifecycleModule,
  type LifecycleStatus,
} from "@/lib/lifecycle"

// جدول الوحدة حسب الاسم.
function tableFor(module: LifecycleModule) {
  if (module === "violations") return violation
  if (module === "incidents") return incident
  throw new Error("وحدة غير مدعومة")
}

function pathsFor(module: LifecycleModule) {
  return [module === "violations" ? "/violations" : "/incidents", "/hr", "/finance", "/"]
}

async function loadRecord(module: LifecycleModule, id: number, organizationId: string) {
  const t = tableFor(module)
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, id), eq(t.organizationId, organizationId)))
    .limit(1)
  if (!row) throw new Error("السجل غير موجود")
  return row
}

// حارس الأرشيف: يُستدعى من كل إجراء يعدّل/يحذف/يرفق على مخالفة أو حادث.
export async function assertNotArchived(module: LifecycleModule, id: number, organizationId: string) {
  const t = tableFor(module)
  const [row] = await db
    .select({ lifecycleStatus: t.lifecycleStatus })
    .from(t)
    .where(and(eq(t.id, id), eq(t.organizationId, organizationId)))
    .limit(1)
  if (row && normalizeLifecycle(row.lifecycleStatus) === "archived") {
    throw new Error("السجل مؤرشف — للقراءة فقط. يمكن لمدير النظام إعادة فتحه.")
  }
}

// تسجيل حدث في سجل الحركة (إدراج فقط).
export async function logRecordEvent(input: {
  organizationId: string
  module: LifecycleModule
  recordId: number
  event: LifecycleEvent
  fromStatus?: string | null
  toStatus?: string | null
  userId?: string
  userName?: string
  note?: string
  meta?: Record<string, unknown>
}) {
  await db.insert(recordEvent).values({
    organizationId: input.organizationId,
    module: input.module,
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

export type RecordEventRow = typeof recordEvent.$inferSelect

export async function getRecordEvents(module: LifecycleModule, recordId: number): Promise<RecordEventRow[]> {
  const { organizationId } = await requireScope()
  return db
    .select()
    .from(recordEvent)
    .where(
      and(
        eq(recordEvent.organizationId, organizationId),
        eq(recordEvent.module, module),
        eq(recordEvent.recordId, recordId),
      ),
    )
    .orderBy(desc(recordEvent.createdAt), desc(recordEvent.id))
}

/* ---------------- الانتقالات ---------------- */

// إحالة: new → referred (أو إعادة إحالة من referred). تُحدَّث الحقول القديمة تزامنياً
// (category/routedTo/hrStatus/financeStatus) لتبقى لوحتا HR والمالية متوافقتين.
export async function referRecord(input: {
  module: LifecycleModule
  id: number
  dept: Dept
  notes?: string
  dueDate?: string | null
}) {
  await assertWritable()
  const u = await requireUser()
  const scope = await requireModuleScope(input.module)
  if (input.dept !== "hr" && input.dept !== "finance") throw new Error("جهة غير صالحة")

  const row = await loadRecord(input.module, input.id, scope.organizationId)
  const from = normalizeLifecycle(row.lifecycleStatus)
  if (from === "archived") throw new Error("السجل مؤرشف — لا يمكن إحالته")
  // يُسمح بإعادة الإحالة من "محالة" لتغيير الجهة.
  if (from !== "referred" && !canTransition(from, "referred")) {
    throw new Error("لا يمكن إحالة السجل في حالته الحالية")
  }

  const t = tableFor(input.module)
  const now = new Date()
  const isHr = input.dept === "hr"
  const legacy =
    input.module === "violations"
      ? {
          category: isHr ? "internal" : "external",
          hrStatus: isHr ? "pending" : null,
          financeStatus: isHr ? null : "pending",
        }
      : {
          routedTo: input.dept,
          hrStatus: isHr ? "pending" : null,
          financeStatus: isHr ? null : "pending",
        }

  await db
    .update(t)
    .set({
      lifecycleStatus: "referred",
      assignedDept: input.dept,
      referralNotes: input.notes ?? "",
      dueDate: input.dueDate || null,
      referredBy: u.name,
      referredAt: now,
      status: "open",
      ...legacy,
    } as never)
    .where(and(eq(t.id, input.id), eq(t.organizationId, scope.organizationId)))

  await logRecordEvent({
    organizationId: scope.organizationId,
    module: input.module,
    recordId: input.id,
    event: "referred",
    fromStatus: from,
    toStatus: "referred",
    userId: u.id,
    userName: u.name,
    note: input.notes ?? "",
    meta: { dept: input.dept, dueDate: input.dueDate ?? null },
  })

  // إشعار داخلي للجهة.
  const docNo = (row as { documentNo?: string | null }).documentNo || `#${input.id}`
  await db.insert(appNotification).values({
    organizationId: scope.organizationId,
    targetModule: input.dept,
    module: input.module,
    recordId: input.id,
    title: input.module === "violations" ? `إحالة مخالفة ${docNo}` : `إحالة حادث ${docNo}`,
    message: input.notes ?? "",
  })

  pathsFor(input.module).forEach((p) => revalidatePath(p))
}

// بدء المعالجة: referred/new → in_progress. مسموح للجهة المحال إليها أو لمدير.
export async function startProcessing(module: LifecycleModule, id: number) {
  await assertWritable()
  const u = await requireUser()
  const scope = await requireScope()
  const row = await loadRecord(module, id, scope.organizationId)
  const from = normalizeLifecycle(row.lifecycleStatus)
  if (!canTransition(from, "in_progress")) throw new Error("لا يمكن بدء المعالجة في الحالة الحالية")

  const dept = row.assignedDept as Dept | null
  const t = tableFor(module)
  const legacy = dept === "hr" ? { hrStatus: "in_review" } : dept === "finance" ? { financeStatus: "in_review" } : {}

  await db
    .update(t)
    .set({ lifecycleStatus: "in_progress", status: "in_progress", ...legacy } as never)
    .where(and(eq(t.id, id), eq(t.organizationId, scope.organizationId)))

  await logRecordEvent({
    organizationId: scope.organizationId,
    module,
    recordId: id,
    event: "in_progress",
    fromStatus: from,
    toStatus: "in_progress",
    userId: u.id,
    userName: u.name,
  })
  pathsFor(module).forEach((p) => revalidatePath(p))
}

// إغلاق: أي حالة نشطة → closed ثم archived تلقائياً. الإجراء المتخذ إلزامي.
export async function closeRecord(input: {
  module: LifecycleModule
  id: number
  closureAction: string
  evidenceDataUrl?: string
}) {
  await assertWritable()
  const u = await requireUser()
  const scope = await requireScope()
  const action = input.closureAction.trim()
  if (!action) throw new Error("الإجراء المتخذ إلزامي عند الإغلاق")

  const row = await loadRecord(input.module, input.id, scope.organizationId)
  const from = normalizeLifecycle(row.lifecycleStatus)
  if (!canTransition(from, "closed")) throw new Error("لا يمكن إغلاق السجل في حالته الحالية")

  // ملف إثبات اختياري → مرفق من نوع closure_evidence.
  let evidenceUrl = ""
  if (input.evidenceDataUrl?.startsWith("data:")) {
    try {
      const saved = await saveDataUrlAttachment(
        u.id,
        scope.organizationId,
        input.module,
        input.id,
        "closure_evidence",
        input.evidenceDataUrl,
        `closure-evidence-${Date.now()}`,
      )
      evidenceUrl = (saved as { url?: string } | undefined)?.url ?? ""
    } catch {
      // فشل رفع الإثبات لا يمنع الإغلاق.
    }
  }

  const dept = row.assignedDept as Dept | null
  const now = new Date()
  const legacy =
    dept === "hr"
      ? { hrStatus: "closed", hrAction: action, hrClosedBy: u.name, hrClosedAt: now }
      : dept === "finance"
        ? { financeStatus: "closed", financeClosedBy: u.name, financeClosedAt: now }
        : {}

  const t = tableFor(input.module)
  await db
    .update(t)
    .set({
      lifecycleStatus: "archived",
      status: "closed",
      closureAction: action,
      closureEvidenceUrl: evidenceUrl,
      lifecycleClosedAt: now,
      lifecycleClosedBy: u.name,
      archivedAt: now,
      ...legacy,
    } as never)
    .where(and(eq(t.id, input.id), eq(t.organizationId, scope.organizationId)))

  const base = {
    organizationId: scope.organizationId,
    module: input.module,
    recordId: input.id,
    userId: u.id,
    userName: u.name,
  }
  await logRecordEvent({ ...base, event: "closed", fromStatus: from, toStatus: "closed", note: action })
  await logRecordEvent({ ...base, event: "archived", fromStatus: "closed", toStatus: "archived" })

  pathsFor(input.module).forEach((p) => revalidatePath(p))
}

// إعادة فتح مؤرشف: أدمن فقط، بسبب إلزامي. تعود إلى in_progress إن كانت لها جهة، وإلا new.
export async function reopenRecord(input: { module: LifecycleModule; id: number; reason: string }) {
  await assertWritable()
  const u = await requireUser()
  const scope = await requireScope()
  if (scope.role !== "admin") throw new Error("إعادة الفتح متاحة لمدير النظام فقط")
  const reason = input.reason.trim()
  if (!reason) throw new Error("سبب إعادة الفتح إلزامي")

  const row = await loadRecord(input.module, input.id, scope.organizationId)
  const from = normalizeLifecycle(row.lifecycleStatus)
  if (from !== "archived") throw new Error("السجل ليس مؤرشفاً")

  const dept = row.assignedDept as Dept | null
  const to: LifecycleStatus = dept ? "in_progress" : "new"
  const legacy =
    dept === "hr"
      ? { hrStatus: "in_review", hrClosedBy: "", hrClosedAt: null }
      : dept === "finance"
        ? { financeStatus: "in_review", financeClosedBy: "", financeClosedAt: null }
        : {}

  const t = tableFor(input.module)
  await db
    .update(t)
    .set({
      lifecycleStatus: to,
      status: to === "new" ? "open" : "in_progress",
      archivedAt: null,
      reopenReason: reason,
      reopenedBy: u.name,
      reopenedAt: new Date(),
      ...legacy,
    } as never)
    .where(and(eq(t.id, input.id), eq(t.organizationId, scope.organizationId)))

  await logRecordEvent({
    organizationId: scope.organizationId,
    module: input.module,
    recordId: input.id,
    event: "reopened",
    fromStatus: from,
    toStatus: to,
    userId: u.id,
    userName: u.name,
    note: reason,
  })
  pathsFor(input.module).forEach((p) => revalidatePath(p))
}

/* ---------------- الإشعارات الداخلية ---------------- */

export async function getUnreadNotificationCount(dept: Dept): Promise<number> {
  const { organizationId } = await requireScope()
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(appNotification)
    .where(
      and(
        eq(appNotification.organizationId, organizationId),
        eq(appNotification.targetModule, dept),
        eq(appNotification.read, false),
      ),
    )
  return r?.n ?? 0
}

export async function getNotifications(dept: Dept) {
  const { organizationId } = await requireScope()
  return db
    .select()
    .from(appNotification)
    .where(and(eq(appNotification.organizationId, organizationId), eq(appNotification.targetModule, dept)))
    .orderBy(desc(appNotification.createdAt))
    .limit(50)
}

export async function markNotificationsRead(dept: Dept, ids?: number[]) {
  await assertWritable()
  const { organizationId } = await requireScope()
  const where = ids?.length
    ? and(eq(appNotification.organizationId, organizationId), inArray(appNotification.id, ids))
    : and(eq(appNotification.organizationId, organizationId), eq(appNotification.targetModule, dept))
  await db.update(appNotification).set({ read: true }).where(where)
  revalidatePath(dept === "hr" ? "/hr" : "/finance")
}
