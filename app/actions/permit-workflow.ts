"use server"

import { and, desc, eq, inArray, lte, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { permit, permitSignature, permitAuditLog, appNotification } from "@/lib/db/schema"
import { requireModuleScope, assertWritable, requireUser } from "@/lib/session"
import { orgWhere } from "@/lib/scope"
import { saveDataUrlAttachment } from "@/lib/attachments-server"
import {
  buildPermitNumber,
  getPermitType,
  normalizePermitStatus,
  type PermitStatus,
  type SignRole,
} from "@/lib/permit-workflow"

// ============ أدوات مساعدة ============
function s(v: FormDataEntryValue | null, fallback = ""): string {
  return v == null ? fallback : String(v)
}
function n(v: FormDataEntryValue | null): number | null {
  const x = Number(v)
  return Number.isFinite(x) && v !== "" && v != null ? x : null
}
function dt(v: FormDataEntryValue | null): Date | null {
  const str = v ? String(v) : ""
  if (!str) return null
  const d = new Date(str)
  return Number.isNaN(d.getTime()) ? null : d
}

async function logPermit(
  organizationId: string,
  permitId: number,
  action: string,
  actorId: string,
  actorName: string,
  note = "",
): Promise<void> {
  await db.insert(permitAuditLog).values({ organizationId, permitId, action, actorId, actorName, note })
}

async function notifyManagers(organizationId: string, permitId: number, title: string, message: string): Promise<void> {
  await db.insert(appNotification).values({
    organizationId,
    targetModule: "permits",
    module: "permits",
    recordId: permitId,
    title,
    message,
  })
}

// ============ قراءة ============
// قائمة التصاريح ضمن المؤسسة (كل الأعضاء يرَون تصاريح مؤسستهم — سجل مشترك).
export async function getPermitsFull() {
  const scope = await requireModuleScope("permits")
  const rows = await db
    .select()
    .from(permit)
    .where(orgWhere(permit.organizationId, scope))
    .orderBy(desc(permit.createdAt))
  // تسلسل التواريخ إلى نص ISO لتمريرها بأمان إلى مكوّن العميل.
  return rows.map((p) => ({
    id: p.id,
    documentNo: p.documentNo,
    title: p.title,
    type: p.type,
    location: p.location,
    requestedBy: p.requestedBy,
    status: p.status,
    startAt: p.startAt ? p.startAt.toISOString() : null,
    endAt: p.endAt ? p.endAt.toISOString() : null,
    archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
    riskLevel: p.riskLevel,
    contractorName: p.contractorName,
    supervisorName: p.supervisorName,
  }))
}

export type PermitAttachment = { url: string; name?: string; kind?: string }
export type PermitDetail = {
  id: number
  documentNo: string | null
  title: string
  type: string | null
  status: string | null
  location: string | null
  requestedBy: string | null
  contractorName: string | null
  supervisorName: string | null
  workersCount: number | null
  riskLevel: string | null
  workDescription: string | null
  startAt: string | null
  endAt: string | null
  extendedTo: string | null
  durationHours: number | null
  createdAt: string | null
  closedAt: string | null
  closedBy: string | null
  archivedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  rejectionReason: string | null
  suspendReason: string | null
  siteConditionAfter: string | null
  areaEvacuated: boolean | null
  checklistAnswers: Record<string, boolean>
  gasTestReadings: Record<string, string>
  isolationLOTO: Record<string, unknown>
  attachments: PermitAttachment[]
  signatures: { id: number; role: string; signerName: string; signatureUrl: string; signedAt: string }[]
  auditLog: { id: number; action: string; actorName: string; note: string; createdAt: string }[]
}

// تفاصيل تصريح واحد كاملة (التصريح + التواقيع + سجل التتبع) في استدعاء واحد،
// مع تحديد النطاق حسب المؤسسة. يعيد null إن لم يوجد أو خارج نطاق المؤسسة.
export async function getPermitById(id: number): Promise<PermitDetail | null> {
  const scope = await requireModuleScope("permits")
  const [row] = await db
    .select()
    .from(permit)
    .where(orgWhere(permit.organizationId, scope, eq(permit.id, id)))
  if (!row) return null

  const [sigs, audit] = await Promise.all([
    db
      .select()
      .from(permitSignature)
      .where(orgWhere(permitSignature.organizationId, scope, eq(permitSignature.permitId, id)))
      .orderBy(permitSignature.signedAt),
    db
      .select()
      .from(permitAuditLog)
      .where(orgWhere(permitAuditLog.organizationId, scope, eq(permitAuditLog.permitId, id)))
      .orderBy(permitAuditLog.createdAt),
  ])

  const iso = (d: Date | null) => (d ? d.toISOString() : null)
  return {
    id: row.id,
    documentNo: row.documentNo,
    title: row.title,
    type: row.type,
    status: row.status,
    location: row.location,
    requestedBy: row.requestedBy,
    contractorName: row.contractorName,
    supervisorName: row.supervisorName,
    workersCount: row.workersCount,
    riskLevel: row.riskLevel,
    workDescription: row.workDescription,
    startAt: iso(row.startAt),
    endAt: iso(row.endAt),
    extendedTo: iso(row.extendedTo),
    durationHours: row.durationHours,
    createdAt: iso(row.createdAt),
    closedAt: iso(row.closedAt),
    closedBy: row.closedBy,
    archivedAt: iso(row.archivedAt),
    approvedBy: row.approvedBy,
    approvedAt: iso(row.approvedAt),
    rejectionReason: row.rejectionReason,
    suspendReason: row.suspendReason,
    siteConditionAfter: row.siteConditionAfter,
    areaEvacuated: row.areaEvacuated,
    checklistAnswers: (row.checklistAnswers as Record<string, boolean>) ?? {},
    gasTestReadings: (row.gasTestReadings as Record<string, string>) ?? {},
    isolationLOTO: (row.isolationLOTO as Record<string, unknown>) ?? {},
    attachments: (row.attachmentsJson as PermitAttachment[]) ?? [],
    signatures: sigs.map((s2) => ({
      id: s2.id,
      role: s2.role,
      signerName: s2.signerName,
      signatureUrl: s2.signatureUrl,
      signedAt: s2.signedAt.toISOString(),
    })),
    auditLog: audit.map((a) => ({
      id: a.id,
      action: a.action,
      actorName: a.actorName,
      note: a.note,
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

export async function getPermitSignatures(permitId: number) {
  const scope = await requireModuleScope("permits")
  return db
    .select()
    .from(permitSignature)
    .where(orgWhere(permitSignature.organizationId, scope, eq(permitSignature.permitId, permitId)))
    .orderBy(permitSignature.signedAt)
}

export async function getPermitAuditLog(permitId: number) {
  const scope = await requireModuleScope("permits")
  return db
    .select()
    .from(permitAuditLog)
    .where(orgWhere(permitAuditLog.organizationId, scope, eq(permitAuditLog.permitId, permitId)))
    .orderBy(desc(permitAuditLog.createdAt))
}

// تحميل توقيع (data URL) إلى Blob وربطه بالتصريح بدور محدد.
async function persistSignature(
  scope: { userId: string; organizationId: string },
  permitId: number,
  role: SignRole,
  signerName: string,
  dataUrl: string,
): Promise<void> {
  if (!dataUrl.startsWith("data:image")) return
  const saved = await saveDataUrlAttachment(
    scope.userId,
    scope.organizationId,
    "permits",
    permitId,
    `sign-${role}`,
    dataUrl,
    `${role}-signature`,
  )
  await db.insert(permitSignature).values({
    permitId,
    organizationId: scope.organizationId,
    role,
    signerName,
    signatureUrl: saved?.url ?? "",
  })
}

// ============ الإنشاء (نموذج ثلاثي الخطوات، مُرسَل كـ FormData) ============
export async function createPermitFull(formData: FormData): Promise<{ documentNo: string }> {
  await assertWritable()
  const scope = await requireModuleScope("permits")
  const { userId, organizationId } = scope

  const type = s(formData.get("type"), "hot_work")
  const typeCfg = getPermitType(type)

  // ترقيم تسلسلي مستقل لكل نوع داخل المؤسسة.
  const year = new Date().getFullYear()
  const existing = await db
    .select({ documentNo: permit.documentNo })
    .from(permit)
    .where(and(eq(permit.organizationId, organizationId), eq(permit.type, type)))
  const maxSeq = existing
    .map((p) => p.documentNo ?? "")
    .filter((no) => no.startsWith(`${typeCfg.prefix}-${year}-`))
    .reduce((max, no) => {
      const seq = parseInt(no.split("-")[2] ?? "0", 10)
      return seq > max ? seq : max
    }, 0)
  const documentNo = buildPermitNumber(type, maxSeq + 1, year)

  const startAt = dt(formData.get("startAt"))
  const endAt = dt(formData.get("endAt"))
  const durationHours =
    startAt && endAt ? Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / 3_600_000)) : n(formData.get("durationHours"))

  // JSON blocks مُرسلة كنصوص من العميل.
  const parseJson = <T,>(key: string, fallback: T): T => {
    try {
      const raw = s(formData.get(key))
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  }

  const [inserted] = await db
    .insert(permit)
    .values({
      userId,
      organizationId,
      documentNo,
      title: s(formData.get("title")) || typeCfg.ar,
      type,
      location: s(formData.get("location")),
      requestedBy: s(formData.get("requestedBy")),
      workDescription: s(formData.get("workDescription")),
      contractorName: s(formData.get("contractorName")),
      workersCount: n(formData.get("workersCount")),
      supervisorName: s(formData.get("supervisorName")),
      startAt,
      endAt,
      durationHours,
      riskLevel: s(formData.get("riskLevel"), typeCfg.defaultRisk),
      checklistAnswers: parseJson<Record<string, boolean>>("checklistAnswers", {}),
      gasTestReadings: parseJson<Record<string, string>>("gasTestReadings", {}),
      isolationLOTO: parseJson<Record<string, unknown>>("isolationLOTO", {}),
      attachmentsJson: parseJson<unknown[]>("attachmentsJson", []),
      status: "pending",
      validFrom: startAt ? startAt.toISOString().slice(0, 10) : null,
      validTo: endAt ? endAt.toISOString().slice(0, 10) : null,
    })
    .returning({ id: permit.id })

  const permitId = inserted!.id

  // توقيع طالب التصريح (إلزامي عند الإنشاء إن وُجد).
  await persistSignature(scope, permitId, "requester", s(formData.get("requestedBy")), s(formData.get("requesterSignature")))

  await logPermit(organizationId, permitId, "created", userId, s(formData.get("requestedBy")), `إنشاء تصريح ${documentNo}`)
  await notifyManagers(organizationId, permitId, `تصريح جديد بانتظار الاعتماد: ${documentNo}`, `${typeCfg.ar} — ${s(formData.get("location"))}`)

  revalidatePath("/permits")
  revalidatePath("/")
  return { documentNo }
}

// ============ سلسلة الاعتماد ============
// يوقّع مراقب السلامة أو المُصدر أو المعتمِد. عند اكتمال توقيع المعتمِد → التصريح ساري.
export async function approvePermit(formData: FormData): Promise<void> {
  await assertWritable()
  const scope = await requireModuleScope("permits")
  if (!scope.isManager) throw new Error("ليس لديك صلاحية لاعتماد التصاريح")
  const u = await requireUser()

  const permitId = Number(formData.get("permitId"))
  const role = s(formData.get("role"), "approver") as SignRole
  const signerName = s(formData.get("signerName"), u.name)
  const signature = s(formData.get("signature"))
  if (!signature.startsWith("data:image")) throw new Error("التوقيع مطلوب لاعتماد التصريح")

  const [row] = await db
    .select()
    .from(permit)
    .where(orgWhere(permit.organizationId, scope, eq(permit.id, permitId)))
  if (!row) throw new Error("التصريح غير موجود")
  if (normalizePermitStatus(row.status) !== "pending") throw new Error("لا يمكن اعتماد تصريح ليس بانتظار الاعتماد")

  await persistSignature(scope, permitId, role, signerName, signature)

  // يصبح التصريح سارياً فقط عند اعتماد المعتمِد النهائي.
  if (role === "approver") {
    await db
      .update(permit)
      .set({ status: "active", approvedBy: signerName, approvedAt: new Date() })
      .where(orgWhere(permit.organizationId, scope, eq(permit.id, permitId)))
    await logPermit(scope.organizationId, permitId, "approved", u.id, signerName, "اعتماد التصريح — أصبح سارياً")
    await notifyManagers(scope.organizationId, permitId, `تم اعتماد التصريح ${row.documentNo}`, "التصريح ساري الآن")
  } else {
    await logPermit(scope.organizationId, permitId, `signed_${role}`, u.id, signerName, `توقيع ${role}`)
  }
  revalidatePath("/permits")
  revalidatePath("/")
}

export async function rejectPermit(formData: FormData): Promise<void> {
  await assertWritable()
  const scope = await requireModuleScope("permits")
  if (!scope.isManager) throw new Error("ليس لديك صلاحية لرفض التصاريح")
  const u = await requireUser()

  const permitId = Number(formData.get("permitId"))
  const reason = s(formData.get("reason")).trim()
  if (!reason) throw new Error("يجب إدخال سبب الرفض")

  await db
    .update(permit)
    .set({ status: "rejected", rejectionReason: reason, approvedBy: u.name, approvedAt: new Date() })
    .where(orgWhere(permit.organizationId, scope, eq(permit.id, permitId)))
  await logPermit(scope.organizationId, permitId, "rejected", u.id, u.name, reason)
  revalidatePath("/permits")
  revalidatePath("/")
}

// ============ الإغلاق (توقيعان إلزاميان: المُصدر ومستلم الموقع) ============
export async function closePermit(formData: FormData): Promise<void> {
  await assertWritable()
  const scope = await requireModuleScope("permits")
  const u = await requireUser()

  const permitId = Number(formData.get("permitId"))
  const issuerSig = s(formData.get("issuerSignature"))
  const receiverSig = s(formData.get("receiverSignature"))
  if (!issuerSig.startsWith("data:image") || !receiverSig.startsWith("data:image")) {
    throw new Error("توقيعا الإغلاق (المُصدر ومستلم الموقع) إلزاميان")
  }

  const [row] = await db
    .select()
    .from(permit)
    .where(orgWhere(permit.organizationId, scope, eq(permit.id, permitId)))
  if (!row) throw new Error("التصريح غير موجود")
  const st = normalizePermitStatus(row.status)
  if (st !== "active" && st !== "suspended" && st !== "expired") {
    throw new Error("لا يمكن إغلاق تصريح بهذه الحالة")
  }

  await persistSignature(scope, permitId, "closeIssuer", s(formData.get("issuerName"), u.name), issuerSig)
  await persistSignature(scope, permitId, "closeReceiver", s(formData.get("receiverName")), receiverSig)

  await db
    .update(permit)
    .set({
      status: "closed",
      closedAt: new Date(),
      closedBy: u.name,
      siteConditionAfter: s(formData.get("siteConditionAfter")),
      areaEvacuated: s(formData.get("areaEvacuated")) === "true",
      archivedAt: new Date(),
    })
    .where(orgWhere(permit.organizationId, scope, eq(permit.id, permitId)))
  await logPermit(scope.organizationId, permitId, "closed", u.id, u.name, "إغلاق التصريح وأرشفته")
  revalidatePath("/permits")
  revalidatePath("/")
}

// ============ تمديد ============
export async function extendPermit(formData: FormData): Promise<void> {
  await assertWritable()
  const scope = await requireModuleScope("permits")
  if (!scope.isManager) throw new Error("ليس لديك صلاحية لتمديد التصاريح")
  const u = await requireUser()

  const permitId = Number(formData.get("permitId"))
  const extendedTo = dt(formData.get("extendedTo"))
  if (!extendedTo) throw new Error("يجب تحديد وقت التمديد")

  const [row] = await db
    .select()
    .from(permit)
    .where(orgWhere(permit.organizationId, scope, eq(permit.id, permitId)))
  if (!row) throw new Error("التصريح غير موجود")

  await db
    .update(permit)
    .set({ endAt: extendedTo, extendedTo, status: "active", validTo: extendedTo.toISOString().slice(0, 10) })
    .where(orgWhere(permit.organizationId, scope, eq(permit.id, permitId)))
  await logPermit(scope.organizationId, permitId, "extended", u.id, u.name, `تمديد حتى ${extendedTo.toLocaleString("ar")}`)
  revalidatePath("/permits")
  revalidatePath("/")
}

// ============ إيقاف مؤقت / استئناف ============
export async function suspendPermit(formData: FormData): Promise<void> {
  await assertWritable()
  const scope = await requireModuleScope("permits")
  if (!scope.isManager) throw new Error("ليس لديك صلاحية لإيقاف التصاريح")
  const u = await requireUser()
  const permitId = Number(formData.get("permitId"))
  const reason = s(formData.get("reason")).trim()
  if (!reason) throw new Error("يجب إدخال سبب الإيقاف")
  await db
    .update(permit)
    .set({ status: "suspended", suspendReason: reason })
    .where(orgWhere(permit.organizationId, scope, eq(permit.id, permitId)))
  await logPermit(scope.organizationId, permitId, "suspended", u.id, u.name, reason)
  revalidatePath("/permits")
}

export async function resumePermit(formData: FormData): Promise<void> {
  await assertWritable()
  const scope = await requireModuleScope("permits")
  if (!scope.isManager) throw new Error("ليس لديك صلاحية لاستئناف التصاريح")
  const u = await requireUser()
  const permitId = Number(formData.get("permitId"))
  await db
    .update(permit)
    .set({ status: "active", suspendReason: "" })
    .where(orgWhere(permit.organizationId, scope, eq(permit.id, permitId)))
  await logPermit(scope.organizationId, permitId, "resumed", u.id, u.name, "استئناف العمل")
  revalidatePath("/permits")
}

// ============ أرشفة يدوية ============
export async function archivePermit(formData: FormData): Promise<void> {
  await assertWritable()
  const scope = await requireModuleScope("permits")
  if (!scope.isManager) throw new Error("ليس لديك صلاحية لأرشفة التصاريح")
  const u = await requireUser()
  const permitId = Number(formData.get("permitId"))
  await db
    .update(permit)
    .set({ archivedAt: new Date() })
    .where(orgWhere(permit.organizationId, scope, eq(permit.id, permitId)))
  await logPermit(scope.organizationId, permitId, "archived", u.id, u.name, "أرشفة يدوية")
  revalidatePath("/permits")
}

// ============ الانتهاء التلقائي (يُستدعى من route handler) ============
// يحوّل كل تصريح ساري/موقوف تجاوز endAt إلى "منتهٍ" وينشئ إشعاراً للمديرين. آمن للتكرار.
export async function expireOverduePermits(organizationId?: string): Promise<{ expired: number }> {
  const now = new Date()
  const base = and(
    inArray(permit.status, ["active", "suspended"]),
    lte(permit.endAt, now),
    ne(permit.status, "closed"),
  )
  const where = organizationId ? and(eq(permit.organizationId, organizationId), base) : base

  const due = await db.select().from(permit).where(where)
  if (due.length === 0) return { expired: 0 }

  for (const p of due) {
    await db.update(permit).set({ status: "expired" }).where(eq(permit.id, p.id))
    await db.insert(permitAuditLog).values({
      organizationId: p.organizationId,
      permitId: p.id,
      action: "expired",
      actorId: "system",
      actorName: "النظام",
      note: "انتهت صلاحية التصريح تلقائياً",
    })
    await db.insert(appNotification).values({
      organizationId: p.organizationId,
      targetModule: "permits",
      module: "permits",
      recordId: p.id,
      title: `انتهت صلاحية التصريح ${p.documentNo}`,
      message: "يجب إغلاق التصريح أو تمديده",
    })
  }
  revalidatePath("/permits")
  revalidatePath("/")
  return { expired: due.length }
}

// نوع مساعد للواجهة.
export type PermitStatusValue = PermitStatus
