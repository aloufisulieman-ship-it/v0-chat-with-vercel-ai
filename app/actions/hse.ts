"use server"

import { db } from "@/lib/db"
import {
  company,
  incident,
  inspection,
  permit,
  risk,
  training,
  employee,
  toolboxSession,
  toolboxAttendee,
  trainingAttendee,
  correctiveAction,
  audit,
  document,
  violation,
  observation,
  attachment,
  user,
  aiDetection,
  orgContextIssue,
  ohsPolicy,
  ohsObjective,
  legalRequirement,
  workerConsultation,
  emergencyPlan,
  contractor,
  managementReview,
  internalAudit,
} from "@/lib/db/schema"
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import {
  roleKindFor,
  AUDITOR_SIGNATURE_ROLE,
  HR_OFFICER_SIGNATURE_ROLE,
  FINANCE_OFFICER_SIGNATURE_ROLE,
} from "@/lib/signature-roles"
import {
  requireModuleScope,
  requireScope,
  requireUser,
  assertWritable,
  type ModuleScope,
} from "@/lib/session"
import { scopeWhere } from "@/lib/scope"
import { getSettingsLock, lockSettings, SETTINGS_LOCKED_MESSAGE } from "@/lib/settings-lock"
import { severityLabels, statusLabels, permitTypePrefix, permitTypeExtraFields } from "@/lib/labels"
import {
  detectionTypeLabels,
  severityLabels as detectionSeverityLabels,
} from "@/lib/ai-monitoring"
import { effectiveViolationStatus } from "@/lib/violation-status"
import { saveDataUrlAttachment } from "@/lib/attachments-server"
import { assertNotArchived, logRecordEvent } from "@/app/actions/lifecycle"
import { deptForClassification } from "@/lib/lifecycle"

function str(v: FormDataEntryValue | null, fallback = "") {
  return v == null ? fallback : String(v)
}
function num(v: FormDataEntryValue | null, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
function dateOrNull(v: FormDataEntryValue | null) {
  const s = v ? String(v) : ""
  return s ? s : null
}

/* ---------------- Company / profile ---------------- */
export async function getCompany() {
  const { userId, organizationId, readOnly } = await requireScope()
  // في وضع عرض مسؤول المنصّة (قراءة فقط) لا يملك المستخدم سجل ملف مؤسسة خاصاً به داخل
  // المؤسسة المدخول إليها، فنعرض ملف المؤسسة التمثيلي (أحدث سجل) بدل نموذج فارغ.
  const rows = await db
    .select()
    .from(company)
    .where(
      readOnly
        ? eq(company.organizationId, organizationId)
        : and(eq(company.organizationId, organizationId), eq(company.userId, userId)),
    )
    .orderBy(desc(company.updatedAt))
    .limit(1)
  return rows[0] ?? null
}

export async function saveCompany(formData: FormData) {
  // قفل الإعداد الأولي: مسؤول المنصّة (readOnly = وضع الدخول إلى المؤسسة) يتجاوز القفل
  // ويعدّل دائماً؛ مدير المؤسسة يُرفض حفظه على الخادم بعد أن يصبح settingsLocked = true.
  const { userId, organizationId, readOnly } = await requireScope()
  const isPlatformAdminActing = readOnly
  if (!isPlatformAdminActing) {
    const { locked } = await getSettingsLock(organizationId)
    if (locked) throw new Error(SETTINGS_LOCKED_MESSAGE)
  }

  // مسؤول المنصّة يعدّل ملف المؤسسة التمثيلي (أحدث صف) بصرف النظر عن صاحبه؛ مستخدم
  // المؤسسة يعدّل صفّه الخاص داخل مؤسسته.
  const existing = isPlatformAdminActing
    ? await db
        .select()
        .from(company)
        .where(eq(company.organizationId, organizationId))
        .orderBy(desc(company.updatedAt))
        .limit(1)
    : await db
        .select()
        .from(company)
        .where(and(eq(company.organizationId, organizationId), eq(company.userId, userId)))
        .limit(1)
  const values = {
    name: str(formData.get("name")),
    industry: str(formData.get("industry")),
    address: str(formData.get("address")),
    phone: str(formData.get("phone")),
    email: str(formData.get("email")),
    employeeCount: num(formData.get("employeeCount")),
    hseManager: str(formData.get("hseManager")),
    updatedAt: new Date(),
  }
  if (existing[0]) {
    await db
      .update(company)
      .set(values)
      .where(and(eq(company.id, existing[0].id), eq(company.organizationId, organizationId)))
  } else {
    await db.insert(company).values({ userId, organizationId, ...values })
  }

  // أول حفظ ناجح من مدير المؤسسة يقفل معلومات المنشأة وإعدادات التشغيل معاً.
  if (!isPlatformAdminActing) await lockSettings(organizationId)

  revalidatePath("/settings")
  revalidatePath("/")
}

/* ---------------- Incidents ---------------- */
export async function getIncidents() {
  const scope = await requireScope()
  return db
    .select()
    .from(incident)
    .where(scopeWhere({ organizationId: incident.organizationId, userId: incident.userId }, scope))
    .orderBy(desc(incident.createdAt))
}
export async function createIncident(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("incidents")
  await db.insert(incident).values({
    userId,
    organizationId,
    title: str(formData.get("title")),
    location: str(formData.get("location")),
    type: str(formData.get("type"), "near_miss"),
    severity: str(formData.get("severity"), "low"),
    status: str(formData.get("status"), "open"),
    reportedBy: str(formData.get("reportedBy")),
    description: str(formData.get("description")),
    incidentDate: dateOrNull(formData.get("incidentDate")),
  })
  revalidatePath("/incidents")
  revalidatePath("/")
}

// Full incident report: auto document number, parties, causes and signatures.
export async function createIncidentFull(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("incidents")

  const title = str(formData.get("title")).trim()
  if (!title) throw new Error("نوع الحادثة مطلوب")

  // التصنيف هو المصدر الوحيد للتوجيه: داخلية → HR، خارجية → المالية.
  // routedTo القديم يُقبل كبديل (توافق خلفي) لكن يُشتق التصنيف منه ثم تُطبَّق القاعدة.
  const rawClass = str(formData.get("classification"))
  const legacyRouted = str(formData.get("routedTo"))
  const classification =
    rawClass === "internal" || rawClass === "external"
      ? rawClass
      : legacyRouted === "finance"
        ? "external"
        : legacyRouted === "hr"
          ? "internal"
          : ""
  if (!classification) throw new Error("يجب تحديد تصنيف الحادثة: داخلية أو خارجية")
  const routedTo = deptForClassification(classification)

  // Auto document number: INC-YYYY-### (تسلسل مستقل لكل مؤسسة، يُصفّر كل سنة).
  const year = new Date().getFullYear()
  const existing = await db
    .select({ documentNo: incident.documentNo })
    .from(incident)
    .where(eq(incident.organizationId, organizationId))
  const thisYearNos = (existing ?? [])
    .map((i) => i.documentNo ?? "")
    .filter((n) => n.startsWith(`INC-${year}-`))
  const maxSeq = thisYearNos.reduce((max, n) => {
    const seq = parseInt(n.split("-")[2] ?? "0", 10)
    return seq > max ? seq : max
  }, 0)
  const documentNo = `INC-${year}-${String(maxSeq + 1).padStart(3, "0")}`

  const [inserted] = await db
    .insert(incident)
    .values({
      userId,
      organizationId,
      documentNo,
      title,
      classification,
      routedTo,
      hrStatus: routedTo === "hr" ? "pending" : null,
      financeStatus: routedTo === "finance" ? "pending" : null,
      type: str(formData.get("type"), "أخرى"),
      severity: str(formData.get("severity"), "low"),
      status: str(formData.get("status"), "open"),
      location: str(formData.get("location")),
      incidentDate: dateOrNull(formData.get("incidentDate")),
      incidentTime: str(formData.get("incidentTime")),
      description: str(formData.get("description")),
      directCauses: str(formData.get("directCauses")),
      rootCauses: str(formData.get("rootCauses")),
      propertyDamage: str(formData.get("propertyDamage")),
      damageCost: str(formData.get("damageCost")),
      immediateActions: str(formData.get("immediateActions")),
      parties: str(formData.get("parties"), "[]"),
      witnesses: str(formData.get("witnesses")),
      authoritiesNotified: str(formData.get("authoritiesNotified"), "no"),
      authorityName: str(formData.get("authorityName")),
      recommendations: str(formData.get("recommendations")),
      reportedBy: str(formData.get("reportedBy")),
      reporterSignature: str(formData.get("reporterSignature")),
      safetySignature: str(formData.get("safetySignature")),
      hrSignature: str(formData.get("hrSignature")),
      gmSignature: str(formData.get("gmSignature")),
      managerSignature: str(formData.get("safetySignature")),
      // دورة الحياة: النموذج يختار الجهة عند الإنشاء، فيُعدّ السجل محالاً مباشرةً.
      source: "manual",
      lifecycleStatus: "referred",
      assignedDept: routedTo,
      referredBy: str(formData.get("reportedBy")),
      referredAt: new Date(),
    })
    .returning({ id: incident.id })

  const recordId = inserted.id
  {
    const base = { organizationId, module: "incidents" as const, recordId, userId, userName: str(formData.get("reportedBy")) }
    await logRecordEvent({ ...base, event: "created", toStatus: "new" })
    await logRecordEvent({ ...base, event: "referred", fromStatus: "new", toStatus: "referred", meta: { dept: routedTo } })
  }

  // Persist the four official signatures as role-named attachments so they
  // render once in the official signatures section and in the PDF export.
  const signaturePairs: { value: string; kind: string; name: string }[] = [
    { value: str(formData.get("reporterSignature")), kind: "signature:reporter", name: "reporter-signature" },
    { value: str(formData.get("safetySignature")), kind: "signature:safety_manager", name: "safety-signature" },
    { value: str(formData.get("hrSignature")), kind: "signature:hr", name: "hr-signature" },
    { value: str(formData.get("gmSignature")), kind: "signature:gm", name: "gm-signature" },
  ]
  for (const sig of signaturePairs) {
    if (sig.value.startsWith("data:image")) {
      await saveDataUrlAttachment(userId, organizationId, "incidents", recordId, sig.kind, sig.value, sig.name)
    }
  }

  // Persist site photos (JSON array of base64 data URLs) as photo attachments.
  try {
    const sitePhotos = JSON.parse(str(formData.get("sitePhotos"), "[]")) as string[]
    for (let i = 0; i < sitePhotos.length; i++) {
      if (typeof sitePhotos[i] === "string" && sitePhotos[i].startsWith("data:image")) {
        await saveDataUrlAttachment(userId, organizationId, "incidents", recordId, "photo", sitePhotos[i], `site-${i + 1}`)
      }
    }
  } catch {
    // ignore malformed payloads; the incident itself is already saved
  }

  // Persist per-party injury photos as photo attachments.
  try {
    const injuryPhotos = JSON.parse(str(formData.get("injuryPhotos"), "[]")) as string[]
    for (let i = 0; i < injuryPhotos.length; i++) {
      if (typeof injuryPhotos[i] === "string" && injuryPhotos[i].startsWith("data:image")) {
        await saveDataUrlAttachment(userId, organizationId, "incidents", recordId, "photo", injuryPhotos[i], `injury-party-${i + 1}`)
      }
    }
  } catch {
    // ignore malformed payloads
  }

  revalidatePath("/incidents")
  revalidatePath("/hr")
  revalidatePath("/finance")
  revalidatePath("/")
  return { documentNo }
}
export async function deleteIncident(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("incidents")
  await assertNotArchived("incidents", id, scope.organizationId)
  await db
    .delete(incident)
    .where(scopeWhere({ organizationId: incident.organizationId, userId: incident.userId }, scope, eq(incident.id, id)))
  revalidatePath("/incidents")
  revalidatePath("/")
}

/* ---------------- Inspections ---------------- */
export async function getInspections() {
  const scope = await requireScope()
  return db
    .select()
    .from(inspection)
    .where(scopeWhere({ organizationId: inspection.organizationId, userId: inspection.userId }, scope))
    .orderBy(desc(inspection.createdAt))
}
export async function createInspection(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("inspections")
  await db.insert(inspection).values({
    userId,
    organizationId,
    title: str(formData.get("title")),
    area: str(formData.get("area")),
    inspector: str(formData.get("inspector")),
    status: str(formData.get("status"), "scheduled"),
    compliance: num(formData.get("compliance")),
    findings: num(formData.get("findings")),
    inspectionDate: dateOrNull(formData.get("inspectionDate")),
  })
  revalidatePath("/inspections")
  revalidatePath("/")
}
export async function deleteInspection(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("inspections")
  await db
    .delete(inspection)
    .where(scopeWhere({ organizationId: inspection.organizationId, userId: inspection.userId }, scope, eq(inspection.id, id)))
  revalidatePath("/inspections")
}

/* ---------------- Permits ---------------- */
export async function getPermits() {
  const scope = await requireScope()
  return db
    .select()
    .from(permit)
    .where(scopeWhere({ organizationId: permit.organizationId, userId: permit.userId }, scope))
    .orderBy(desc(permit.createdAt))
}
export async function createPermit(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("permits")
  const type = str(formData.get("type"), "construction")
  const prefix = permitTypePrefix[type] ?? "PTW"
  const year = new Date().getFullYear()

  // ترقيم تسلسلي مستقل لكل نوع تصريح داخل المؤسسة (مثال: CWP-2026-001).
  const existing = await db
    .select({ documentNo: permit.documentNo })
    .from(permit)
    .where(and(eq(permit.organizationId, organizationId), eq(permit.type, type)))
  const thisYearNos = existing.map((p) => p.documentNo ?? "").filter((n) => n.startsWith(`${prefix}-${year}-`))
  const maxSeq = thisYearNos.reduce((max, n) => {
    const seq = parseInt(n.split("-")[2] ?? "0", 10)
    return seq > max ? seq : max
  }, 0)
  const documentNo = `${prefix}-${year}-${String(maxSeq + 1).padStart(3, "0")}`

  // الحقول الديناميكية الخاصة بالنوع تُخزّن كـ JSON في عمود details.
  const details: Record<string, string> = {}
  for (const f of permitTypeExtraFields[type] ?? []) {
    details[f.name] = str(formData.get(f.name))
  }

  await db.insert(permit).values({
    userId,
    organizationId,
    documentNo,
    title: str(formData.get("title")),
    type,
    location: str(formData.get("location")),
    requestedBy: str(formData.get("requestedBy")),
    status: str(formData.get("status"), "pending"),
    validFrom: dateOrNull(formData.get("validFrom")),
    validTo: dateOrNull(formData.get("validTo")),
    details: JSON.stringify(details),
  })
  revalidatePath("/permits")
  revalidatePath("/")
}
export async function deletePermit(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("permits")
  await db
    .delete(permit)
    .where(scopeWhere({ organizationId: permit.organizationId, userId: permit.userId }, scope, eq(permit.id, id)))
  revalidatePath("/permits")
}

// يحدد ما إذا كان المستخدم يملك صلاح��ة اعتماد/رفض التصاريح (مدير).
function isPermitApprover(role: string, department: string): boolean {
  return role === "admin" || department === "المدير العام" || department === "مفتش السلامة"
}

// اعتماد أو رفض تصريح عمل من قِبل المدير، مع تسجيل اسم ال��عتمِد والتاريخ والسب��.
// مقيّد بمؤسسة المعتمِد: لا يمكن اعتماد تصريح تابع لمؤسسة أخرى.
export async function updatePermitStatus(
  permitId: number,
  status: "approved" | "rejected",
  approverName: string,
  notes?: string,
) {
  await assertWritable()
  const u = await requireUser()
  if (!isPermitApprover(u.role, u.department)) {
    throw new Error("ليس لديك صلاحية لاعتماد أو رفض التصاريح")
  }
  if (status !== "approved" && status !== "rejected") {
    throw new Error("حالة غير صالحة")
  }
  if (status === "rejected" && !notes?.trim()) {
    throw new Error("سبب الرفض مطلوب")
  }

  await db
    .update(permit)
    .set({
      status,
      approvedBy: approverName?.trim() || u.name,
      approvedAt: new Date(),
      rejectionReason: status === "rejected" ? (notes?.trim() ?? "") : "",
    })
    .where(and(eq(permit.id, permitId), eq(permit.organizationId, u.organizationId)))

  revalidatePath("/permits")
  revalidatePath("/")
}

/* ---------------- Risks ---------------- */
export async function getRisks() {
  const scope = await requireScope()
  return db
    .select()
    .from(risk)
    .where(scopeWhere({ organizationId: risk.organizationId, userId: risk.userId }, scope))
    .orderBy(desc(risk.createdAt))
}
export async function createRisk(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("risks")
  await db.insert(risk).values({
    userId,
    organizationId,
    hazard: str(formData.get("hazard")),
    activity: str(formData.get("activity")),
    likelihood: num(formData.get("likelihood"), 1),
    consequence: num(formData.get("consequence"), 1),
    controls: str(formData.get("controls")),
    owner: str(formData.get("owner")),
    status: str(formData.get("status"), "open"),
  })
  revalidatePath("/risks")
  revalidatePath("/")
}
export async function deleteRisk(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("risks")
  await db
    .delete(risk)
    .where(scopeWhere({ organizationId: risk.organizationId, userId: risk.userId }, scope, eq(risk.id, id)))
  revalidatePath("/risks")
}

/* ---------------- Training ---------------- */
export async function getTrainings() {
  const scope = await requireScope()
  return db
    .select()
    .from(training)
    .where(scopeWhere({ organizationId: training.organizationId, userId: training.userId }, scope))
    .orderBy(desc(training.createdAt))
}
export async function createTraining(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("training")
  await db.insert(training).values({
    userId,
    organizationId,
    title: str(formData.get("title")),
    trainer: str(formData.get("trainer")),
    attendees: num(formData.get("attendees")),
    status: str(formData.get("status"), "scheduled"),
    trainingDate: dateOrNull(formData.get("trainingDate")),
  })
  revalidatePath("/training")
}
export type AttendeeInput = {
  name: string
  designation: string
  company: string
  cardCode: string
  understood: string
  signature: string
}

// Full training record (MHS-IMS-FR-HSE-2): course header + dynamic attendees
// table. Attendees are stored in training_attendee; signatures (trainer + each
// attendee) are also persisted to the attachment table like violation signatures.
export async function createTrainingFull(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("training")

  const title = str(formData.get("title")).trim()
  if (!title) throw new Error("اسم الدورة مطلوب")

  const trainerSignature = str(formData.get("trainerSignature"))

  const [inserted] = await db
    .insert(training)
    .values({
      userId,
      organizationId,
      title,
      trainer: str(formData.get("conductedBy")),
      conductedBy: str(formData.get("conductedBy")),
      language: str(formData.get("language")),
      status: str(formData.get("status"), "scheduled"),
      trainingDate: dateOrNull(formData.get("trainingDate")),
      trainerSignature,
    })
    .returning({ id: training.id })

  const trainingId = inserted.id

  // Parse and persist attendees.
  let attendeesList: AttendeeInput[] = []
  try {
    attendeesList = JSON.parse(str(formData.get("attendeesList"), "[]")) as AttendeeInput[]
  } catch {
    attendeesList = []
  }
  const cleaned = attendeesList.filter((a) => (a.name ?? "").trim() !== "")

  if (cleaned.length > 0) {
    await db.insert(trainingAttendee).values(
      cleaned.map((a, i) => ({
        trainingId,
        userId,
        organizationId,
        rowNo: i + 1,
        name: a.name ?? "",
        designation: a.designation ?? "",
        company: a.company || "MHS",
        cardCode: a.cardCode ?? "",
        understood: a.understood === "no" ? "no" : "yes",
        signature: a.signature ?? "",
      })),
    )
  }

  // Keep the cached attendee count on the training row in sync (داخل نفس المؤسسة).
  await db
    .update(training)
    .set({ attendees: cleaned.length })
    .where(and(eq(training.id, trainingId), eq(training.organizationId, organizationId)))

  // Persist trainer signature as an attachment (same pattern as violations).
  if (trainerSignature.startsWith("data:image")) {
    await saveDataUrlAttachment(userId, organizationId, "training", trainingId, "signature:trainer", trainerSignature, "trainer-signature")
  }

  revalidatePath("/training")
  return { trainingId }
}

export async function getEmployees() {
  const { userId, organizationId } = await requireScope()
  return db
    .select()
    .from(employee)
    .where(and(eq(employee.organizationId, organizationId), eq(employee.userId, userId)))
    .orderBy(employee.designation, employee.name)
}

function employeeValues(formData: FormData) {
  const employeeId = str(formData.get("employeeId")).trim()
  const name = str(formData.get("name")).trim()
  const designation = str(formData.get("designation")).trim()
  if (!employeeId || !name) throw new Error("الرقم الوظيفي والاسم حقول مطلوبة")
  return {
    employeeId,
    name,
    designation,
    department: str(formData.get("department")).trim(),
    company: str(formData.get("company"), "MHS").trim() || "MHS",
    nationality: str(formData.get("nationality")).trim(),
    profileStatus: designation ? "complete" : "incomplete",
    cardCode: str(formData.get("cardCode")).trim(),
    uniformNumber: str(formData.get("uniformNumber")).trim(),
    phone: str(formData.get("phone")).trim(),
    photoUrl: str(formData.get("photoUrl")).trim(),
    active: formData.get("active") !== "false",
    updatedAt: new Date(),
  }
}

export async function createEmployee(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireScope()
  await db.insert(employee).values({ userId, organizationId, ...employeeValues(formData) })
  revalidatePath("/employees")
  revalidatePath("/training")
  revalidatePath("/violations")
}

export async function updateEmployee(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireScope()
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف الموظف غير صالح")
  await db
    .update(employee)
    .set(employeeValues(formData))
    .where(and(eq(employee.id, id), eq(employee.organizationId, organizationId), eq(employee.userId, userId)))
  revalidatePath("/employees")
  revalidatePath("/training")
  revalidatePath("/violations")
}

export async function deleteEmployee(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireScope()
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف الموظف غير صالح")
  await db
    .delete(employee)
    .where(and(eq(employee.id, id), eq(employee.organizationId, organizationId), eq(employee.userId, userId)))
  revalidatePath("/employees")
  revalidatePath("/training")
  revalidatePath("/violations")
}

type ToolboxAttendeeInput = {
  employeeRefId?: number | null
  employeeId?: string
  name?: string
  jobTitle?: string
  designation?: string
  company?: string
  cardCode?: string
  signature?: string
}

type ToolboxSessionInput = {
  id?: string | number
  sourceKey?: string
  documentNo?: string
  date?: string
  time?: string
  location?: string
  topic?: string
  speaker?: string
  summary?: string
  photos?: string[]
  attendees?: ToolboxAttendeeInput[]
}

async function nextToolboxDocumentNo(organizationId: string, dateValue?: string) {
  const year = (dateValue || new Date().toISOString()).slice(0, 4)
  const rows = await db.select({ documentNo: toolboxSession.documentNo }).from(toolboxSession).where(eq(toolboxSession.organizationId, organizationId))
  const max = rows.reduce((value, row) => {
    const match = row.documentNo.match(new RegExp(`^TB-${year}-(\\d+)$`))
    return Math.max(value, match ? Number(match[1]) : 0)
  }, 0)
  return `TB-${year}-${String(max + 1).padStart(3, "0")}`
}

async function resolveToolboxEmployee(userId: string, organizationId: string, attendee: ToolboxAttendeeInput) {
  const employeeId = (attendee.employeeId ?? "").trim()
  const name = (attendee.name ?? "").trim()
  if (!name || !employeeId) throw new Error("الاسم والرقم الوظيفي مطلوبان لكل حاضر")
  const [existing] = await db.select().from(employee).where(and(eq(employee.organizationId, organizationId), eq(employee.userId, userId), eq(employee.employeeId, employeeId))).limit(1)
  if (existing) return existing
  const [created] = await db.insert(employee).values({
    userId,
    organizationId,
    employeeId,
    name,
    designation: (attendee.designation ?? attendee.jobTitle ?? "").trim(),
    company: (attendee.company ?? "MHS").trim() || "MHS",
    cardCode: (attendee.cardCode ?? "").trim(),
    profileStatus: (attendee.designation ?? attendee.jobTitle ?? "").trim() ? "complete" : "incomplete",
  }).returning()
  return created
}

export async function getToolboxSessions() {
  const { userId, organizationId } = await requireModuleScope("training")
  const sessions = await db.select().from(toolboxSession).where(and(eq(toolboxSession.organizationId, organizationId), eq(toolboxSession.userId, userId))).orderBy(desc(toolboxSession.createdAt))
  const attendees = await db.select().from(toolboxAttendee).where(and(eq(toolboxAttendee.organizationId, organizationId), eq(toolboxAttendee.userId, userId))).orderBy(toolboxAttendee.id)
  return sessions.map((session) => ({
    ...session,
    photos: JSON.parse(session.photos || "[]") as string[],
    attendees: attendees.filter((item) => item.sessionId === session.id).map((item) => ({
      id: String(item.id), employeeRefId: item.employeeRefId, employeeId: item.employeeId, name: item.name,
      jobTitle: item.designation, company: item.company, cardCode: item.cardCode, signature: item.signature,
    })),
  }))
}

async function persistToolboxSession(userId: string, organizationId: string, input: ToolboxSessionInput) {
  const sourceKey = input.sourceKey || `server-${crypto.randomUUID()}`
  const [existing] = await db.select().from(toolboxSession).where(and(eq(toolboxSession.organizationId, organizationId), eq(toolboxSession.userId, userId), eq(toolboxSession.sourceKey, sourceKey))).limit(1)
  if (existing) return existing
  const documentNo = input.documentNo || await nextToolboxDocumentNo(organizationId, input.date)
  const [created] = await db.insert(toolboxSession).values({
    userId, organizationId, sourceKey, documentNo, date: input.date ?? "", time: input.time ?? "", location: input.location ?? "",
    topic: input.topic ?? "", speaker: input.speaker ?? "", summary: input.summary ?? "", photos: JSON.stringify(input.photos ?? []),
  }).returning()
  const attendeeRows = input.attendees ?? []
  for (const attendee of attendeeRows) {
    const linked = await resolveToolboxEmployee(userId, organizationId, attendee)
    await db.insert(toolboxAttendee).values({
      userId, organizationId, sessionId: created.id, employeeRefId: linked.id, employeeId: linked.employeeId,
      name: attendee.name?.trim() || linked.name, designation: attendee.designation ?? attendee.jobTitle ?? linked.designation,
      company: attendee.company || linked.company || "MHS", cardCode: attendee.cardCode ?? linked.cardCode ?? "", signature: attendee.signature ?? "",
    })
  }
  return created
}

export async function saveToolboxSession(input: ToolboxSessionInput) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("training")
  const created = await persistToolboxSession(userId, organizationId, input)
  revalidatePath("/training")
  revalidatePath("/employees")
  return { id: created.id, documentNo: created.documentNo }
}

export async function importToolboxSessions(inputs: ToolboxSessionInput[]) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("training")
  for (const input of inputs) await persistToolboxSession(userId, organizationId, { ...input, sourceKey: input.sourceKey || `local-${input.id}` })
  revalidatePath("/training")
  revalidatePath("/employees")
}

export async function deleteToolboxSession(id: number) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("training")
  const [owned] = await db.select({ id: toolboxSession.id }).from(toolboxSession).where(and(eq(toolboxSession.id, id), eq(toolboxSession.organizationId, organizationId), eq(toolboxSession.userId, userId))).limit(1)
  if (!owned) throw new Error("الجلسة غير موجودة")
  await db.delete(toolboxAttendee).where(and(eq(toolboxAttendee.sessionId, id), eq(toolboxAttendee.organizationId, organizationId), eq(toolboxAttendee.userId, userId)))
  await db.delete(toolboxSession).where(and(eq(toolboxSession.id, id), eq(toolboxSession.organizationId, organizationId), eq(toolboxSession.userId, userId)))
  revalidatePath("/training")
}

export async function getTrainingAttendees(trainingId: number) {
  const { userId, organizationId } = await requireScope()
  return db
    .select()
    .from(trainingAttendee)
    .where(and(eq(trainingAttendee.trainingId, trainingId), eq(trainingAttendee.organizationId, organizationId), eq(trainingAttendee.userId, userId)))
    .orderBy(trainingAttendee.rowNo)
}

// All attendees for the current user, grouped by trainingId (for the list page).
export async function getAllTrainingAttendees() {
  const { userId, organizationId } = await requireScope()
  const rows = await db
    .select()
    .from(trainingAttendee)
    .where(and(eq(trainingAttendee.organizationId, organizationId), eq(trainingAttendee.userId, userId)))
    .orderBy(trainingAttendee.rowNo)
  const map: Record<number, typeof rows> = {}
  for (const r of rows) {
    ;(map[r.trainingId] ??= []).push(r)
  }
  return map
}

export async function deleteTraining(id: number) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("training")
  await db.delete(trainingAttendee).where(and(eq(trainingAttendee.trainingId, id), eq(trainingAttendee.organizationId, organizationId), eq(trainingAttendee.userId, userId)))
  await db.delete(training).where(and(eq(training.id, id), eq(training.organizationId, organizationId), eq(training.userId, userId)))
  revalidatePath("/training")
}


/* ---------------- Corrective actions ---------------- */
export async function getActions() {
  const scope = await requireScope()
  return db
    .select()
    .from(correctiveAction)
    .where(scopeWhere({ organizationId: correctiveAction.organizationId, userId: correctiveAction.userId }, scope))
    .orderBy(desc(correctiveAction.createdAt))
}
export async function createAction(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("actions")
  await db.insert(correctiveAction).values({
    userId,
    organizationId,
    title: str(formData.get("title")),
    source: str(formData.get("source")),
    assignedTo: str(formData.get("assignedTo")),
    priority: str(formData.get("priority"), "medium"),
    status: str(formData.get("status"), "open"),
    dueDate: dateOrNull(formData.get("dueDate")),
  })
  revalidatePath("/actions")
  revalidatePath("/")
}
export async function deleteAction(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("actions")
  await db
    .delete(correctiveAction)
    .where(scopeWhere({ organizationId: correctiveAction.organizationId, userId: correctiveAction.userId }, scope, eq(correctiveAction.id, id)))
  revalidatePath("/actions")
}

/* ---------------- Audits ---------------- */
export async function getAudits() {
  const scope = await requireScope()
  return db
    .select()
    .from(audit)
    .where(scopeWhere({ organizationId: audit.organizationId, userId: audit.userId }, scope))
    .orderBy(desc(audit.createdAt))
}
export async function createAudit(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("audits")
  await db.insert(audit).values({
    userId,
    organizationId,
    title: str(formData.get("title")),
    standard: str(formData.get("standard")),
    auditor: str(formData.get("auditor")),
    score: num(formData.get("score")),
    status: str(formData.get("status"), "scheduled"),
    auditDate: dateOrNull(formData.get("auditDate")),
  })
  revalidatePath("/audits")
}
export async function deleteAudit(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("audits")
  await db
    .delete(audit)
    .where(scopeWhere({ organizationId: audit.organizationId, userId: audit.userId }, scope, eq(audit.id, id)))
  revalidatePath("/audits")
}

/* ---------------- Documents ---------------- */
export async function getDocuments() {
  const scope = await requireScope()
  return db
    .select()
    .from(document)
    .where(scopeWhere({ organizationId: document.organizationId, userId: document.userId }, scope))
    .orderBy(desc(document.createdAt))
}
export async function createDocument(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("documents")
  await db.insert(document).values({
    userId,
    organizationId,
    title: str(formData.get("title")),
    category: str(formData.get("category")),
    version: str(formData.get("version"), "1.0"),
    owner: str(formData.get("owner")),
    status: str(formData.get("status"), "active"),
    reviewDate: dateOrNull(formData.get("reviewDate")),
  })
  revalidatePath("/documents")
}
export async function deleteDocument(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("documents")
  await db
    .delete(document)
    .where(scopeWhere({ organizationId: document.organizationId, userId: document.userId }, scope, eq(document.id, id)))
  revalidatePath("/documents")
}

/* ---------------- ISO 45001 · سياق المنظمة (البند 4) ---------------- */
export async function getContextIssues() {
  const scope = await requireScope()
  return db
    .select()
    .from(orgContextIssue)
    .where(scopeWhere({ organizationId: orgContextIssue.organizationId, userId: orgContextIssue.userId }, scope))
    .orderBy(desc(orgContextIssue.createdAt))
}
export async function createContextIssue(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("context")
  await db.insert(orgContextIssue).values({
    userId,
    organizationId,
    kind: str(formData.get("kind"), "internal"),
    title: str(formData.get("title")),
    description: str(formData.get("description")),
    needs: str(formData.get("needs")),
    impact: str(formData.get("impact"), "medium"),
  })
  revalidatePath("/context")
  revalidatePath("/compliance")
}
export async function deleteContextIssue(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("context")
  await db
    .delete(orgContextIssue)
    .where(scopeWhere({ organizationId: orgContextIssue.organizationId, userId: orgContextIssue.userId }, scope, eq(orgContextIssue.id, id)))
  revalidatePath("/context")
  revalidatePath("/compliance")
}

/* ---------------- ISO 45001 · سياسة السلامة (البند 5.2) ---------------- */
export async function getPolicies() {
  const scope = await requireScope()
  return db
    .select()
    .from(ohsPolicy)
    .where(scopeWhere({ organizationId: ohsPolicy.organizationId, userId: ohsPolicy.userId }, scope))
    .orderBy(desc(ohsPolicy.createdAt))
}
export async function createPolicy(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("policy")
  await db.insert(ohsPolicy).values({
    userId,
    organizationId,
    title: str(formData.get("title")),
    version: str(formData.get("version"), "1.0"),
    statement: str(formData.get("statement")),
    approvedBy: str(formData.get("approvedBy")),
    approvedDate: dateOrNull(formData.get("approvedDate")),
    reviewDate: dateOrNull(formData.get("reviewDate")),
    status: str(formData.get("status"), "draft"),
  })
  revalidatePath("/policy")
  revalidatePath("/compliance")
}
export async function deletePolicy(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("policy")
  await db
    .delete(ohsPolicy)
    .where(scopeWhere({ organizationId: ohsPolicy.organizationId, userId: ohsPolicy.userId }, scope, eq(ohsPolicy.id, id)))
  revalidatePath("/policy")
  revalidatePath("/compliance")
}

/* ---------------- ISO 45001 · الأهداف والخطط (البند 6.2) ---------------- */
export async function getObjectives() {
  const scope = await requireScope()
  return db
    .select()
    .from(ohsObjective)
    .where(scopeWhere({ organizationId: ohsObjective.organizationId, userId: ohsObjective.userId }, scope))
    .orderBy(desc(ohsObjective.createdAt))
}
export async function createObjective(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("objectives")
  const progress = Math.max(0, Math.min(100, num(formData.get("progress"))))
  await db.insert(ohsObjective).values({
    userId,
    organizationId,
    title: str(formData.get("title")),
    indicator: str(formData.get("indicator")),
    baseline: str(formData.get("baseline")),
    target: str(formData.get("target")),
    responsible: str(formData.get("responsible")),
    progress,
    status: str(formData.get("status"), "not_started"),
    dueDate: dateOrNull(formData.get("dueDate")),
  })
  revalidatePath("/objectives")
  revalidatePath("/compliance")
}
export async function deleteObjective(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("objectives")
  await db
    .delete(ohsObjective)
    .where(scopeWhere({ organizationId: ohsObjective.organizationId, userId: ohsObjective.userId }, scope, eq(ohsObjective.id, id)))
  revalidatePath("/objectives")
  revalidatePath("/compliance")
}

/* ---------------- ISO 45001 · السجل القانوني (البند 6.1.3) ---------------- */
export async function getLegalRequirements() {
  const scope = await requireScope()
  return db
    .select()
    .from(legalRequirement)
    .where(scopeWhere({ organizationId: legalRequirement.organizationId, userId: legalRequirement.userId }, scope))
    .orderBy(desc(legalRequirement.createdAt))
}
export async function createLegalRequirement(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("legal-register")
  await db.insert(legalRequirement).values({
    userId,
    organizationId,
    title: str(formData.get("title")),
    reference: str(formData.get("reference")),
    authority: str(formData.get("authority")),
    category: str(formData.get("category")),
    applicability: str(formData.get("applicability")),
    complianceStatus: str(formData.get("complianceStatus"), "compliant"),
    lastReviewDate: dateOrNull(formData.get("lastReviewDate")),
  })
  revalidatePath("/legal-register")
  revalidatePath("/compliance")
}
export async function deleteLegalRequirement(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("legal-register")
  await db
    .delete(legalRequirement)
    .where(scopeWhere({ organizationId: legalRequirement.organizationId, userId: legalRequirement.userId }, scope, eq(legalRequirement.id, id)))
  revalidatePath("/legal-register")
  revalidatePath("/compliance")
}

/* ---------------- ISO 45001 · تشاور العمال (البند 5.4) ---------------- */
export async function getConsultations() {
  const scope = await requireScope()
  return db
    .select()
    .from(workerConsultation)
    .where(scopeWhere({ organizationId: workerConsultation.organizationId, userId: workerConsultation.userId }, scope))
    .orderBy(desc(workerConsultation.createdAt))
}
export async function createConsultation(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("consultation")
  await db.insert(workerConsultation).values({
    userId,
    organizationId,
    topic: str(formData.get("topic")),
    activityType: str(formData.get("activityType"), "consultation"),
    method: str(formData.get("method"), "meeting"),
    participants: Math.max(0, num(formData.get("participants"))),
    outcome: str(formData.get("outcome")),
    activityDate: dateOrNull(formData.get("activityDate")),
  })
  revalidatePath("/consultation")
  revalidatePath("/compliance")
}
export async function deleteConsultation(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("consultation")
  await db
    .delete(workerConsultation)
    .where(scopeWhere({ organizationId: workerConsultation.organizationId, userId: workerConsultation.userId }, scope, eq(workerConsultation.id, id)))
  revalidatePath("/consultation")
  revalidatePath("/compliance")
}

/* ---------------- ISO 45001 · التأهب للطوارئ (البند 8.2) ---------------- */
export async function getEmergencyPlans() {
  const scope = await requireScope()
  return db
    .select()
    .from(emergencyPlan)
    .where(scopeWhere({ organizationId: emergencyPlan.organizationId, userId: emergencyPlan.userId }, scope))
    .orderBy(desc(emergencyPlan.createdAt))
}
export async function createEmergencyPlan(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("emergency")
  await db.insert(emergencyPlan).values({
    userId,
    organizationId,
    scenario: str(formData.get("scenario")),
    planType: str(formData.get("planType"), "fire"),
    responsibleTeam: str(formData.get("responsibleTeam")),
    lastDrillDate: dateOrNull(formData.get("lastDrillDate")),
    nextDrillDate: dateOrNull(formData.get("nextDrillDate")),
    status: str(formData.get("status"), "ready"),
  })
  revalidatePath("/emergency")
  revalidatePath("/compliance")
}
export async function deleteEmergencyPlan(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("emergency")
  await db
    .delete(emergencyPlan)
    .where(scopeWhere({ organizationId: emergencyPlan.organizationId, userId: emergencyPlan.userId }, scope, eq(emergencyPlan.id, id)))
  revalidatePath("/emergency")
  revalidatePath("/compliance")
}

/* ---------------- ISO 45001 · المقاولون (البند 8.1.4) ---------------- */
export async function getContractors() {
  const scope = await requireScope()
  return db
    .select()
    .from(contractor)
    .where(scopeWhere({ organizationId: contractor.organizationId, userId: contractor.userId }, scope))
    .orderBy(desc(contractor.createdAt))
}
export async function createContractor(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("contractors")
  await db.insert(contractor).values({
    userId,
    organizationId,
    name: str(formData.get("name")),
    scope: str(formData.get("scope")),
    hseRating: Math.max(0, Math.min(100, num(formData.get("hseRating")))),
    evaluationDate: dateOrNull(formData.get("evaluationDate")),
    status: str(formData.get("status"), "approved"),
  })
  revalidatePath("/contractors")
  revalidatePath("/compliance")
}
export async function deleteContractor(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("contractors")
  await db
    .delete(contractor)
    .where(scopeWhere({ organizationId: contractor.organizationId, userId: contractor.userId }, scope, eq(contractor.id, id)))
  revalidatePath("/contractors")
  revalidatePath("/compliance")
}

/* ---------------- ISO 45001 · مراجعة الإدارة (البند 9.3) ---------------- */
export async function getManagementReviews() {
  const scope = await requireScope()
  return db
    .select()
    .from(managementReview)
    .where(scopeWhere({ organizationId: managementReview.organizationId, userId: managementReview.userId }, scope))
    .orderBy(desc(managementReview.createdAt))
}
export async function createManagementReview(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("management-review")
  await db.insert(managementReview).values({
    userId,
    organizationId,
    title: str(formData.get("title")),
    reviewDate: dateOrNull(formData.get("reviewDate")),
    attendees: str(formData.get("attendees")),
    inputs: str(formData.get("inputs")),
    decisions: str(formData.get("decisions")),
    nextReviewDate: dateOrNull(formData.get("nextReviewDate")),
  })
  revalidatePath("/management-review")
  revalidatePath("/compliance")
}
export async function deleteManagementReview(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("management-review")
  await db
    .delete(managementReview)
    .where(scopeWhere({ organizationId: managementReview.organizationId, userId: managementReview.userId }, scope, eq(managementReview.id, id)))
  revalidatePath("/management-review")
  revalidatePath("/compliance")
}

/* ---------------- ISO 45001 · التدقيق الداخلي (البند 9.2) ---------------- */
export async function getInternalAudits() {
  const scope = await requireScope()
  return db
    .select()
    .from(internalAudit)
    .where(scopeWhere({ organizationId: internalAudit.organizationId, userId: internalAudit.userId }, scope))
    .orderBy(desc(internalAudit.createdAt))
}
export async function createInternalAudit(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("internal-audit")
  await db.insert(internalAudit).values({
    userId,
    organizationId,
    title: str(formData.get("title")),
    scope: str(formData.get("scope")),
    auditor: str(formData.get("auditor")),
    auditDate: dateOrNull(formData.get("auditDate")),
    nonconformities: Math.max(0, num(formData.get("nonconformities"))),
    status: str(formData.get("status"), "planned"),
    result: str(formData.get("result")),
  })
  revalidatePath("/internal-audit")
  revalidatePath("/compliance")
}
export async function deleteInternalAudit(id: number) {
  await assertWritable()
  const scope = await requireModuleScope("internal-audit")
  await db
    .delete(internalAudit)
    .where(scopeWhere({ organizationId: internalAudit.organizationId, userId: internalAudit.userId }, scope, eq(internalAudit.id, id)))
  revalidatePath("/internal-audit")
  revalidatePath("/compliance")
}

/* ---------------- Violations ---------------- */
  export async function getViolations() {
  const scope = await requireModuleScope("violations")
  return db
    .select()
    .from(violation)
    .where(scopeWhere({ organizationId: violation.organizationId, userId: violation.userId }, scope))
    .orderBy(desc(violation.createdAt))
}

// التواقيع الرسمية الإضافية الخاصة بالمخالفات الآلية (الناتجة عن الرصد الذكي).
// مخالفة آلية = مرتبطة باكتشاف ذكي عبر aiDetection.linkedViolationNo (المؤشر
// الرسمي الذي يضبطه acceptDetectionAsViolation)، وليس عبر مطابقة نصوص هشّة.
// نُعيد لكل مخالفة آلية رابطَي توقيع "المدقق" و"موظف الموارد البشرية" على مستوى
// المؤسسة (لا المستخدم) ليظهرا لأي مُطّلع بصرف النظر عمّن وقّع. القيمة "" تعني
// "لم يتم التوقيع بعد". المخالفات اليدوية لا تظهر في الخريطة إطلاقاً، فلا تتأثر.
export async function getAiViolationSignatureInfo(): Promise<
  Record<number, { auditor: string; hrOfficer: string }>
> {
  const scope = await requireModuleScope("violations")

  const dets = await db
    .select({ no: aiDetection.linkedViolationNo })
    .from(aiDetection)
    .where(and(eq(aiDetection.organizationId, scope.organizationId), isNotNull(aiDetection.linkedViolationNo)))
  const aiDocNos = new Set(dets.map((d) => d.no).filter((n): n is string => !!n))
  if (aiDocNos.size === 0) return {}

  const vios = await db
    .select({ id: violation.id, documentNo: violation.documentNo })
    .from(violation)
    .where(scopeWhere({ organizationId: violation.organizationId, userId: violation.userId }, scope))
  const aiVios = vios.filter((v) => v.documentNo && aiDocNos.has(v.documentNo))
  if (aiVios.length === 0) return {}
  const ids = aiVios.map((v) => v.id)

  const auditorKind = roleKindFor(AUDITOR_SIGNATURE_ROLE.key)
  const hrKind = roleKindFor(HR_OFFICER_SIGNATURE_ROLE.key)
  const sigs = await db
    .select({ recordId: attachment.recordId, kind: attachment.kind, url: attachment.url })
    .from(attachment)
    .where(
      and(
        eq(attachment.organizationId, scope.organizationId),
        eq(attachment.module, "violations"),
        inArray(attachment.recordId, ids),
        inArray(attachment.kind, [auditorKind, hrKind]),
      ),
    )

  const result: Record<number, { auditor: string; hrOfficer: string }> = {}
  for (const v of aiVios) result[v.id] = { auditor: "", hrOfficer: "" }
  for (const s of sigs) {
    const entry = result[s.recordId]
    if (!entry) continue
    if (s.kind === auditorKind) entry.auditor = s.url ?? ""
    else if (s.kind === hrKind) entry.hrOfficer = s.url ?? ""
  }
  return result
}

// توقيعات الحوادث الرسمية المخزّنة كمرفقات (المدقّق، مسؤول HR، مسؤول المالية) لكل حادثة
// في نطاق المستخدم. تُدمَج في نافذة التفاصيل مع توقيعات النموذج (المُبلّغ/السلامة/HR/المدير العام).
export async function getIncidentSignatureInfo(): Promise<
  Record<number, { auditor: string; hrOfficer: string; financeOfficer: string }>
> {
  const scope = await requireModuleScope("incidents")
  const rows = await db
    .select({ id: incident.id })
    .from(incident)
    .where(scopeWhere({ organizationId: incident.organizationId, userId: incident.userId }, scope))
  const ids = rows.map((r) => r.id)
  if (ids.length === 0) return {}

  const auditorKind = roleKindFor(AUDITOR_SIGNATURE_ROLE.key)
  const hrKind = roleKindFor(HR_OFFICER_SIGNATURE_ROLE.key)
  const finKind = roleKindFor(FINANCE_OFFICER_SIGNATURE_ROLE.key)
  const sigs = await db
    .select({ recordId: attachment.recordId, kind: attachment.kind, url: attachment.url })
    .from(attachment)
    .where(
      and(
        eq(attachment.organizationId, scope.organizationId),
        eq(attachment.module, "incidents"),
        inArray(attachment.recordId, ids),
        inArray(attachment.kind, [auditorKind, hrKind, finKind]),
      ),
    )

  const result: Record<number, { auditor: string; hrOfficer: string; financeOfficer: string }> = {}
  for (const s of sigs) {
    const entry = (result[s.recordId] ??= { auditor: "", hrOfficer: "", financeOfficer: "" })
    if (s.kind === auditorKind) entry.auditor = s.url ?? ""
    else if (s.kind === hrKind) entry.hrOfficer = s.url ?? ""
    else if (s.kind === finKind) entry.financeOfficer = s.url ?? ""
  }
  return result
}

export async function createViolationFull(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("violations")
  const year = new Date().getFullYear()
  const existing = await db.select({ documentNo: violation.documentNo }).from(violation).where(eq(violation.organizationId, organizationId)).orderBy(desc(violation.createdAt))
  const thisYearNos = existing.map((v) => v.documentNo ?? "").filter((n) => n.startsWith(`VIO-${year}-`))
  const maxSeq = thisYearNos.reduce((max, n) => {
    const seq = parseInt(n.split("-")[2] ?? "0", 10)
    return seq > max ? seq : max
  }, 0)
  const documentNo = `VIO-${year}-${String(maxSeq + 1).padStart(3, "0")}`

  const employeeName = str(formData.get("employeeName")).trim()
  if (!employeeName) throw new Error("اسم الموظف مطلوب")
  const requestedEmployeeRefId = Number(formData.get("employeeRefId"))
  const employeeRefId = Number.isFinite(requestedEmployeeRefId) && requestedEmployeeRefId > 0
    ? (await db.select({ id: employee.id }).from(employee).where(and(eq(employee.id, requestedEmployeeRefId), eq(employee.organizationId, organizationId), eq(employee.userId, userId))).limit(1))[0]?.id ?? null
    : null

  // مسار إحالة حصري حسب التصنيف: ا��داخلية → الموارد البشرية، الخارجية → المالية.
  // تُضبط حالة الجهة المعنية فقط، ويبقى الحقل المعاكس null دائماً.
  const category = str(formData.get("category"))
  if (category !== "internal" && category !== "external") {
    throw new Error("يجب تحديد تصنيف المخ��لفة: داخلية أو خارجية")
  }
  const isExternal = category === "external"

  // Pass every column explicitly so nothing falls back to a DB default.
  const [inserted] = await db
    .insert(violation)
    .values({
      userId,
      organizationId,
      documentNo,
      companyName: str(formData.get("companyName")),
      employeeRefId,
      employeeName,
      employeeNo: str(formData.get("employeeNo")),
      nationality: str(formData.get("nationality")),
      violationType: str(formData.get("violationType")),
      category,
      entryMode: str(formData.get("entryMode"), "electronic"),
      detectedBy: str(formData.get("detectedBy")),
      internalAction: str(formData.get("internalAction")),
      violationDate: dateOrNull(formData.get("violationDate")),
      violationTime: str(formData.get("violationTime")),
      place: str(formData.get("place")),
      description: str(formData.get("description")),
      witnesses: str(formData.get("witnesses")),
      evidences: str(formData.get("evidences")),
      proposedAction: str(formData.get("proposedAction")),
      status: str(formData.get("status"), "open"),
      hrStatus: isExternal ? null : "pending",
      financeStatus: isExternal ? "pending" : null,
      editorSignature: str(formData.get("editorSignature")),
      violatorSignature: str(formData.get("violatorSignature")),
      managerSignature: str(formData.get("managerSignature")),
      // دورة الحياة: التصنيف المختار عند الإنشاء يحيل السجل مباشرةً للجهة المقابلة.
      source: "manual",
      lifecycleStatus: "referred",
      assignedDept: isExternal ? "finance" : "hr",
      referredBy: str(formData.get("detectedBy")),
      referredAt: new Date(),
    })
    .returning({ id: violation.id })

  const recordId = inserted.id
  {
    const base = { organizationId, module: "violations" as const, recordId, userId, userName: str(formData.get("detectedBy")) }
    await logRecordEvent({ ...base, event: "created", toStatus: "new" })
    await logRecordEvent({ ...base, event: "referred", fromStatus: "new", toStatus: "referred", meta: { dept: isExternal ? "finance" : "hr" } })
  }

  // Persist evidence photos (sent as a JSON array of base64 data URLs) as
  // real attachments so they show up in the details dialog and PDF export.
  try {
    const images = JSON.parse(str(formData.get("images"), "[]")) as string[]
    for (let i = 0; i < images.length; i++) {
      if (typeof images[i] === "string" && images[i].startsWith("data:image")) {
        await saveDataUrlAttachment(userId, organizationId, "violations", recordId, "photo", images[i], `evidence-${i + 1}`)
      }
    }
  } catch {
    // ignore malformed image payloads; the violation itself is already saved
  }

  // للمخالفات اليدوية: احفظ النموذج الورقي الممسوح (PDF/صورة/مستند) كمرفق
  // بنوع "manual_form" ليظهر في نافذة التفاصيل للتحميل.
  try {
    const docs = JSON.parse(str(formData.get("manualDocs"), "[]")) as string[]
    for (let i = 0; i < docs.length; i++) {
      if (typeof docs[i] === "string" && docs[i].startsWith("data:")) {
        await saveDataUrlAttachment(userId, organizationId, "violations", recordId, "manual_form", docs[i], `manual-form-${i + 1}`)
      }
    }
  } catch {
    // ignore malformed document payloads; the violation itself is already saved
  }

  // Persist the three drawn signatures as role-named attachments so they
  // render once in the official signatures section (no duplication in fields).
  const signaturePairs: { value: string; kind: string; name: string }[] = [
    { value: str(formData.get("violatorSignature")), kind: "signature:violator", name: "violator-signature" },
    { value: str(formData.get("editorSignature")), kind: "signature:reporter", name: "reporter-signature" },
    { value: str(formData.get("managerSignature")), kind: "signature:safety_manager", name: "manager-signature" },
  ]
  for (const sig of signaturePairs) {
    if (sig.value.startsWith("data:image")) {
      await saveDataUrlAttachment(userId, organizationId, "violations", recordId, sig.kind, sig.value, sig.name)
    }
  }

  revalidatePath("/violations")
  revalidatePath("/")
  return { documentNo }
}

// قبول اكتشاف من المراقبة الذكية وتحويله إلى مخالفة رسمية.
// يُنشئ سجل مخالفة برقم تلقائي (VIO-YYYY-###) ويوجّهه حصرياً حسب التصنيف:
//   داخلية → مسار الموارد البشرية (hrStatus=pending، financeStatus=null)
//   خارجية → مسار المالية (financeStatus=pending، رقم التسوية فارغ، hrStatus=null)
// ثم يحدّث حالة الاكتشاف إلى "converted" ويربطه برقم المخالفة الجديد.
export async function acceptDetectionAsViolation(
  detectionId: number,
  category: "internal" | "external",
  ) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("ai_monitoring")
  if (category !== "internal" && category !== "external") {
    throw new Error("يجب تحديد تصنيف المخالفة: داخلية أو خارجية")
  }

  const [det] = await db
    .select()
    .from(aiDetection)
    .where(and(eq(aiDetection.id, detectionId), eq(aiDetection.organizationId, organizationId)))
    .limit(1)
  if (!det) throw new Error("الاكتشاف غير موجود")
  if (det.status === "converted" && det.linkedViolationNo) {
    // مُحوّل مسبقاً — أعد رق������ المخالف�� القائم دون إنشاء تكرار.
    return { documentNo: det.linkedViolationNo }
  }
  // حماية إضافية من التحويل المزدوج: هل توجد مخالفة مرتبطة بهذا الاكتشاف أصلاً؟
  const [already] = await db
    .select({ documentNo: violation.documentNo })
    .from(violation)
    .where(and(eq(violation.organizationId, organizationId), eq(violation.sourceDetectionId, detectionId)))
    .limit(1)
  if (already?.documentNo) {
    await db
      .update(aiDetection)
      .set({ status: "converted", linkedViolationNo: already.documentNo })
      .where(and(eq(aiDetection.id, detectionId), eq(aiDetection.organizationId, organizationId)))
    return { documentNo: already.documentNo }
  }

  const actorRows = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1)
  const actor = actorRows[0]?.name || "مستخدم"

  // رقم مخالفة تسلسلي حسب السنة داخل المؤسسة (بنفس آلية createViolationFull).
  const year = new Date().getFullYear()
  const existing = await db
    .select({ documentNo: violation.documentNo })
    .from(violation)
    .where(eq(violation.organizationId, organizationId))
    .orderBy(desc(violation.createdAt))
  const maxSeq = existing
    .map((v) => v.documentNo ?? "")
    .filter((n) => n.startsWith(`VIO-${year}-`))
    .reduce((max, n) => {
      const seq = parseInt(n.split("-")[2] ?? "0", 10)
      return seq > max ? seq : max
    }, 0)
  const documentNo = `VIO-${year}-${String(maxSeq + 1).padStart(3, "0")}`

  const typeLabel = detectionTypeLabels[det.detectionType] ?? det.detectionType
  const sevLabel = detectionSeverityLabels[det.severity] ?? det.severity
  const now = new Date()
  const isExternal = category === "external"
  const description =
    (det.notes && det.notes.trim().length > 0 ? det.notes.trim() : typeLabel) +
    ` — درجة الخطورة: ${sevLabel} (رصد آلي بالمراقبة الذكية، نسبة الثقة ${det.confidenceScore}%).`

  const [inserted] = await db
    .insert(violation)
    .values({
      userId,
      organizationId,
      documentNo,
      employeeName: "غير محدد — رصد آلي",
      violationType: typeLabel,
      category,
      entryMode: "electronic",
      detectedBy: det.inspectorName || actor,
      // تاريخ/وقت الرصد الفعلي من الاكتشاف (لا وقت التحويل).
      violationDate: (det.detectedAt ?? now).toISOString().slice(0, 10),
      violationTime: (det.detectedAt ?? now).toTimeString().slice(0, 5),
      place: det.cameraLocation || "",
      description,
      status: "open",
      hrStatus: isExternal ? null : "pending",
      financeStatus: isExternal ? "pending" : null,
      settlementNumber: "",
      // دورة الحياة: مصدر ثابت "رصد آلي"، محالة مباشرةً للجهة حسب التصنيف.
      source: "ai_detection",
      lifecycleStatus: "referred",
      assignedDept: isExternal ? "finance" : "hr",
      referredBy: actor,
      referredAt: now,
      aiConfidence: det.confidenceScore ?? null,
      aiSeverity: det.severity ?? "",
      aiCameraId: det.cameraId ?? "",
      sourceDetectionId: det.id,
    })
    .returning({ id: violation.id })

  const recordId = inserted.id

  await logRecordEvent({
    organizationId,
    module: "violations",
    recordId,
    event: "converted_from_ai",
    fromStatus: "",
    toStatus: "referred",
    userId,
    userName: actor,
    meta: { detectionId: det.id, confidence: det.confidenceScore, severity: det.severity, cameraId: det.cameraId, dept: isExternal ? "finance" : "hr" },
  })

  // أرفق لقطة الإثبات كمرفق صورة للمخالفة — أفضل جهد لا يُفشل العملية.
  // اللقطات تُخزَّن في ai_detections.snapshotUrl كـ data URL بصيغة base64 (ناتج
  // canvas.toDataURL من الك��ميرا)، لا كرابط http. لذا نمرّرها مباشرةً إلى
  // saveDataUrlAttachment التي ترفعها إلى Blob وتحفظ رابط URL فقط في جدول المرفقات
  // (لا يُخزَّن الـ base64 الضخم في قاعدة البيانات). ندعم أيضاً حالة رابط http
  // القديمة كخيار احتياطي بجلبها وتحويلها إ��ى data URL.
  try {
    const snap = det.snapshotUrl?.trim() || ""
    if (snap.startsWith("data:image")) {
      await saveDataUrlAttachment(userId, organizationId, "violations", recordId, "photo", snap, "ai-detection-evidence")
    } else if (snap.startsWith("http")) {
      const res = await fetch(snap)
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        const contentType = res.headers.get("content-type") || "image/jpeg"
        const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`
        await saveDataUrlAttachment(userId, organizationId, "violations", recordId, "photo", dataUrl, "ai-detection-evidence")
      }
    }
  } catch {
    // تجاهل فشل إرفاق اللقطة — المخالفة محفوظة أصلاً.
  }

  // حدّث الاكتشاف: الحالة "converted" + الربط برقم المخالفة الجديد (داخل نفس المؤسسة).
  // convertedToViolationId هو الرابط الرقمي الذي تعتمده رسوم الاتجاه لمنع العدّ المزدوج.
  await db
    .update(aiDetection)
    .set({ status: "converted", linkedViolationNo: documentNo, convertedToViolationId: recordId, resolvedBy: actor })
    .where(and(eq(aiDetection.id, detectionId), eq(aiDetection.organizationId, organizationId)))

  revalidatePath("/ai-monitoring")
  revalidatePath("/violations")
  revalidatePath("/")
  return { documentNo }
}

// تعديل يدوي كامل للمخالفة — مقتصر على مدير النظام (admin) فقط.
// يسمح بتصحيح أي حقل ورفع نماذج ورقية ممسوحة إضافية للمخالفات اليدوية.
export async function updateViolation(formData: FormData) {
  await assertWritable()
  const { userId, organizationId, role } = await requireScope()
  if (role !== "admin") throw new Error("التعديل اليدوي متاح لمدير النظام فقط")

  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف غير صالح")
  await assertNotArchived("violations", id, organizationId)

  const employeeName = str(formData.get("employeeName")).trim()
  if (!employeeName) throw new Error("اسم الموظف مطلوب")

  // مسار إحالة حصري حسب التصنيف. نقرأ الحالة القائمة للجهة الصحيحة لنحافظ عليها،
  // ونمسح دائماً الحقل (والإغلاق) الخاص بالجهة المعاكسة لضمان عدم اجتماع الاثنين.
  const category = str(formData.get("category"), "internal")
  const isExternal = category === "external"
  const [current] = await db
    .select({ hrStatus: violation.hrStatus, financeStatus: violation.financeStatus })
    .from(violation)
    .where(and(eq(violation.id, id), eq(violation.organizationId, organizationId)))
    .limit(1)
  if (!current) throw new Error("المخالفة غير موجودة")

  const referral = isExternal
    ? {
        financeStatus: current?.financeStatus ?? "pending",
        // مسح جهة الموارد البشرية بالكامل.
        hrStatus: null, hrAction: "", hrActionDate: null, hrNotes: "",
        hrClosedBy: "", hrClosedAt: null, hrAttachmentUrl: "",
      }
    : {
        hrStatus: current?.hrStatus ?? "pending",
        // مسح جهة المالية بالكامل.
        financeStatus: null, settlementNumber: "", paymentReceiptUrl: "",
        financeClosedBy: "", financeClosedAt: null,
      }

  await db
    .update(violation)
    .set({
      companyName: str(formData.get("companyName")),
      employeeName,
      employeeNo: str(formData.get("employeeNo")),
      nationality: str(formData.get("nationality")),
      violationType: str(formData.get("violationType")),
      category,
      entryMode: str(formData.get("entryMode"), "electronic"),
      detectedBy: str(formData.get("detectedBy")),
      internalAction: str(formData.get("internalAction")),
      violationDate: dateOrNull(formData.get("violationDate")),
      violationTime: str(formData.get("violationTime")),
      place: str(formData.get("place")),
      description: str(formData.get("description")),
      witnesses: str(formData.get("witnesses")),
      proposedAction: str(formData.get("proposedAction")),
      status: str(formData.get("status"), "open"),
      ...referral,
    })
    .where(and(eq(violation.id, id), eq(violation.organizationId, organizationId)))

  // إرفاق نماذج ورقية ممسوحة إضافية إن وُجدت.
  try {
    const docs = JSON.parse(str(formData.get("manualDocs"), "[]")) as string[]
    for (let i = 0; i < docs.length; i++) {
      if (typeof docs[i] === "string" && docs[i].startsWith("data:")) {
        await saveDataUrlAttachment(userId, organizationId, "violations", id, "manual_form", docs[i], `manual-form-edit-${Date.now()}-${i + 1}`)
      }
    }
  } catch {
    // ignore malformed document payloads; the edit itself is already saved
  }

  revalidatePath("/violations")
  revalidatePath("/")
}

export async function deleteViolation(id: number) {
  await assertWritable()
  const { userId, organizationId, isManager } = await requireModuleScope("violations")
  const v = await db
    .select()
    .from(violation)
    .where(and(eq(violation.id, id), eq(violation.organizationId, organizationId)))
    .limit(1)
  if (!v[0]) throw new Error("المخالفة غير موجودة")
  await assertNotArchived("violations", id, organizationId)
  const canDelete = isManager || v[0].userId === userId
  if (!canDelete) throw new Error("غير مصرح لك بالحذف")
  await db.delete(violation).where(and(eq(violation.id, id), eq(violation.organizationId, organizationId)))
  revalidatePath("/violations")
  revalidatePath("/")
}

/* ---------------- Observations & positives (ملاحظات وإيجابيات الجولة) ---------------- */

// يجلب كل الملاحظات/الإيجابيات الخاصة بالمستخدم؛ المدراء يرون الجميع.
export async function getObservations() {
  const scope = await requireModuleScope("violations")
  return db
    .select()
    .from(observation)
    .where(scopeWhere({ organizationId: observation.organizationId, userId: observation.userId }, scope))
    .orderBy(desc(observation.createdAt))
}

// يحفظ ملاحظة (observation) أو ملاحظة إيجابية (positive) من الجولة، ويولّد رقم
// وثيقة رسمي: OBS-YYYY-XXX للملاحظات�� POS-YYYY-XXX للإيجابيات.
export async function createObservationFull(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("violations")
  const kind = str(formData.get("kind"), "observation") === "positive" ? "positive" : "observation"
  const prefix = kind === "positive" ? "POS" : "OBS"
  const year = new Date().getFullYear()

  const existing = await db
    .select({ documentNo: observation.documentNo })
    .from(observation)
    .where(and(eq(observation.organizationId, organizationId), eq(observation.kind, kind)))
  const thisYearNos = existing.map((o) => o.documentNo ?? "").filter((n) => n.startsWith(`${prefix}-${year}-`))
  const maxSeq = thisYearNos.reduce((max, n) => {
    const seq = parseInt(n.split("-")[2] ?? "0", 10)
    return seq > max ? seq : max
  }, 0)
  const documentNo = `${prefix}-${year}-${String(maxSeq + 1).padStart(3, "0")}`

  const description = str(formData.get("description")).trim()
  if (!description) throw new Error("وصف الملاحظة مطلوب")

  const [inserted] = await db
    .insert(observation)
    .values({
      userId,
      organizationId,
      patrolId: str(formData.get("patrolId")),
      kind,
      documentNo,
      description,
      location: str(formData.get("location")),
      observedBy: str(formData.get("observedBy")),
      observationDate: dateOrNull(formData.get("observationDate")),
      observationTime: str(formData.get("observationTime")),
      status: str(formData.get("status"), "open"),
    })
    .returning({ id: observation.id })

  const recordId = inserted.id

  // حفظ الصور المرفقة (مصفوفة base64) كمرفقات حقيقية على وحدة observations.
  try {
    const images = JSON.parse(str(formData.get("images"), "[]")) as string[]
    for (let i = 0; i < images.length; i++) {
      if (typeof images[i] === "string" && images[i].startsWith("data:image")) {
        await saveDataUrlAttachment(userId, organizationId, "observations", recordId, "photo", images[i], `photo-${i + 1}`)
      }
    }
  } catch {
    // نتجاهل الصور غير الصالحة؛ السجل نفسه محفوظ.
  }

  revalidatePath("/")
  revalidatePath("/reports")
  return { documentNo }
}

export async function deleteObservation(id: number) {
  await assertWritable()
  const { userId, organizationId, isManager } = await requireModuleScope("violations")
  const rows = await db
    .select()
    .from(observation)
    .where(and(eq(observation.id, id), eq(observation.organizationId, organizationId)))
    .limit(1)
  if (!rows[0]) throw new Error("الملاحظة غير موجودة")
  const canDelete = isManager || rows[0].userId === userId
  if (!canDelete) throw new Error("غير مص��ح لك بالحذف")
  await db.delete(observation).where(and(eq(observation.id, id), eq(observation.organizationId, organizationId)))
  revalidatePath("/")
  revalidatePath("/reports")
}

/* ---------------- Dashboard aggregates ---------------- */
// نقطة شهرية في اتجاه الحوادث. monthKey = "YYYY-MM" (تُنسَّق في الواجهة حسب اللغة).
// عدّان: حسب شهر الوقوع (occurrence) وحسب شهر التسجيل (registration). الحوادث المسجّلة فقط —
// الحادث الناتج عن تحويل كشف ذكي يُحسب هنا مرة واحدة (سجلّه في incident) ولا يظهر في رسم الكشوفات.
export type TrendPoint = {
  monthKey: string
  incidentsByOccurrence: number
  incidentsByRegistration: number
}

// نقطة شهرية في اتجاه كشوفات المراقبة الذكية، مقسّمة بالنوع، مع عدّاد منفصل للمحوَّلة.
// byType يشمل الكشوفات غير المحوَّلة فقط (بنود مفتوحة/مؤكَّدة)؛ converted تُعرض بلون مختلف.
export type DetectionTrendPoint = {
  monthKey: string
  byType: Record<string, number>
  converted: number
}

// اتجاه الحوادث لآخر 12 شهراً عبر generate_series حتى تظهر الأشهر الفارغة بقيمة 0.
// التجميع على COALESCE(incidentDate, createdAt) للوقوع، وعلى createdAt للتسجيل.
// لا تُستبعد المؤرشفة/المغلقة (الاتجاه تاريخي)؛ يُستبعد الملغى فقط.
async function getIncidentTrend(scope: Awaited<ReturnType<typeof requireScope>>): Promise<TrendPoint[]> {
  const userFilter = scope.isManager ? sql`true` : sql`"userId" = ${scope.userId}`
  const result = await db.execute(sql`
    with months as (
      select (date_trunc('month', now()) - (g * interval '1 month')) as m
      from generate_series(11, 0, -1) as g
    ),
    inc as (
      select
        date_trunc('month', coalesce("incidentDate"::timestamp, "createdAt")) as m_occ,
        date_trunc('month', "createdAt") as m_reg
      from incident
      where "organizationId" = ${scope.organizationId}
        and ${userFilter}
        and coalesce(status, '') <> 'cancelled'
        and coalesce(lifecycle_status, '') <> 'cancelled'
    )
    select
      to_char(months.m, 'YYYY-MM') as month_key,
      (select count(*) from inc where inc.m_occ = months.m)::int as inc_occ,
      (select count(*) from inc where inc.m_reg = months.m)::int as inc_reg
    from months
    order by months.m
  `)
  const rows = result.rows as Array<{ month_key: string; inc_occ: number; inc_reg: number }>
  return rows.map((r) => ({
    monthKey: r.month_key,
    incidentsByOccurrence: Number(r.inc_occ) || 0,
    incidentsByRegistration: Number(r.inc_reg) || 0,
  }))
}

// اتجاه كشوفات المراقبة الذكية لآخر 12 شهراً حسب detected_at، مقسّماً بالنوع.
// - تُستبعد الإنذارات الكاذبة (false_positive) كلياً.
// - الكشف المحوَّل إلى حادثة/مخالفة (converted_to_* أو status = converted) لا يُعدّ بنداً
//   مفتوحاً ضمن نوعه؛ يُجمَع في عدّاد "converted" مستقل ليُعرض بلون مختلف بدل إخفائه.
async function getDetectionTrend(scope: Awaited<ReturnType<typeof requireScope>>): Promise<DetectionTrendPoint[]> {
  const userFilter = scope.isManager ? sql`true` : sql`"userId" = ${scope.userId}`
  const result = await db.execute(sql`
    with months as (
      select (date_trunc('month', now()) - (g * interval '1 month')) as m
      from generate_series(11, 0, -1) as g
    ),
    det as (
      select
        date_trunc('month', detected_at) as m,
        detection_type,
        (converted_to_incident_id is not null or converted_to_violation_id is not null or status = 'converted') as is_converted
      from ai_detections
      where "organizationId" = ${scope.organizationId}
        and ${userFilter}
        and status <> 'false_positive'
    )
    select
      to_char(months.m, 'YYYY-MM') as month_key,
      coalesce(
        (select jsonb_object_agg(detection_type, c)
           from (select detection_type, count(*)::int as c from det where det.m = months.m and not is_converted group by detection_type) x),
        '{}'::jsonb
      ) as by_type,
      (select count(*) from det where det.m = months.m and is_converted)::int as converted
    from months
    order by months.m
  `)
  const rows = result.rows as Array<{ month_key: string; by_type: Record<string, number> | string; converted: number }>
  return rows.map((r) => ({
    monthKey: r.month_key,
    byType: typeof r.by_type === "string" ? (JSON.parse(r.by_type) as Record<string, number>) : (r.by_type ?? {}),
    converted: Number(r.converted) || 0,
  }))
}

// صفّ تجميعي: شهر × نوع × خطورة، مع العدّ الكلي وعدد الحالات المفتوحة. يُغطّي آخر 24 شهراً
// (بحسب شهر الوقوع COALESCE(incidentDate, createdAt)) حتى تستطيع الواجهة حساب أي فترة
// (3/6/12 شهراً أو السنة الحالية) والفترة السابقة المقابلة لها للمقارنة، دون استعلام إضافي.
export type IncidentTypeBreakdownRow = {
  monthKey: string
  type: string
  severity: "low" | "medium" | "high" | "critical"
  total: number
  open: number
}

export async function getIncidentTypeBreakdown(): Promise<IncidentTypeBreakdownRow[]> {
  const scope = await requireScope()
  const userFilter = scope.isManager ? sql`true` : sql`"userId" = ${scope.userId}`
  const result = await db.execute(sql`
    select
      to_char(date_trunc('month', coalesce("incidentDate"::timestamp, "createdAt")), 'YYYY-MM') as month_key,
      coalesce(nullif(type, ''), 'near_miss') as type,
      case when severity in ('low', 'medium', 'high', 'critical') then severity else 'low' end as severity,
      count(*)::int as total,
      count(*) filter (where status in ('open', 'in_progress', 'investigating'))::int as open
    from incident
    where "organizationId" = ${scope.organizationId}
      and ${userFilter}
      and coalesce(status, '') <> 'cancelled'
      and coalesce(lifecycle_status, '') <> 'cancelled'
      and coalesce("incidentDate"::timestamp, "createdAt") >= date_trunc('month', now()) - interval '23 months'
    group by 1, 2, 3
    order by 1, 2, 3
  `)
  const rows = result.rows as Array<{ month_key: string; type: string; severity: string; total: number; open: number }>
  return rows.map((r) => ({
    monthKey: r.month_key,
    type: r.type,
    severity: r.severity as IncidentTypeBreakdownRow["severity"],
    total: Number(r.total) || 0,
    open: Number(r.open) || 0,
  }))
}

// عدد الحوادث الحرجة المفتوحة التي لا يرتبط بها أي إجراء تصحيحي. الرابط الوحيد المتاح في
// المخطط الحالي هو نصّي: corrective_action.source يحوي رقم وثيقة الحادث (documentNo)،
// لذا نطابق عليه داخل المؤسسة نفسها. تُستخدم لشارة التنبيه في رسم توزيع الخطورة.
export async function getCriticalWithoutAction(): Promise<number> {
  const scope = await requireScope()
  const userFilter = scope.isManager ? sql`true` : sql`i."userId" = ${scope.userId}`
  const result = await db.execute(sql`
    select count(*)::int as n
    from incident i
    where i."organizationId" = ${scope.organizationId}
      and ${userFilter}
      and i.severity = 'critical'
      and i.status in ('open', 'in_progress', 'investigating')
      and coalesce(i.lifecycle_status, '') <> 'cancelled'
      and not exists (
        select 1 from corrective_action a
        where a."organizationId" = i."organizationId"
          and coalesce(i."documentNo", '') <> ''
          and a.source ilike '%' || i."documentNo" || '%'
      )
  `)
  const row = result.rows[0] as { n?: number } | undefined
  return Number(row?.n) || 0
}

export async function getDashboardData() {
  const scope = await requireScope()
  // العزل بين المؤسسات صارم (organizationId دائماً)؛ وداخل المؤسسة يرى المديرُ كل
  // السجلات والموظفُ سجلاته فقط عبر scopeWhere.
  const [inc, ins, per, rsk, act, obs, vio, trend, detectionTrend] = await Promise.all([
    db.select().from(incident).where(scopeWhere({ organizationId: incident.organizationId, userId: incident.userId }, scope)),
    db.select().from(inspection).where(scopeWhere({ organizationId: inspection.organizationId, userId: inspection.userId }, scope)),
    db.select().from(permit).where(scopeWhere({ organizationId: permit.organizationId, userId: permit.userId }, scope)),
    db.select().from(risk).where(scopeWhere({ organizationId: risk.organizationId, userId: risk.userId }, scope)),
    db.select().from(correctiveAction).where(scopeWhere({ organizationId: correctiveAction.organizationId, userId: correctiveAction.userId }, scope)),
    db.select().from(observation).where(scopeWhere({ organizationId: observation.organizationId, userId: observation.userId }, scope)),
    db
      .select()
      .from(violation)
      .where(scopeWhere({ organizationId: violation.organizationId, userId: violation.userId }, scope))
      .orderBy(desc(violation.createdAt)),
    getIncidentTrend(scope).catch((err) => {
      console.error("[dashboard] incident trend query failed:", err instanceof Error ? err.message : err)
      return [] as TrendPoint[]
    }),
    getDetectionTrend(scope).catch((err) => {
      console.error("[dashboard] detection trend query failed:", err instanceof Error ? err.message : err)
      return [] as DetectionTrendPoint[]
    }),
  ])
  return {
    incidents: inc,
    inspections: ins,
    permits: per,
    risks: rsk,
    actions: act,
    observations: obs,
    violations: vio,
    trend,
    detectionTrend,
  }
}

/* ---------------- Reports ---------------- */
export type ReportType = "incidents" | "violations" | "inspections" | "observations" | "positives" | "all"

export type ReportRow = Record<string, string | number | null>

export type ReportSection = {
  key: ReportType
  title: string
  columns: { key: string; label: string }[]
  rows: ReportRow[]
}

// Filters a date-like field against an inclusive [from, to] range (YYYY-MM-DD).
function inRange(value: string | null | undefined, from: string, to: string) {
  if (!value) return false
  const d = value.slice(0, 10)
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

// Returns report sections filtered by type and date range. Each section is
// fully shaped for table preview, PDF and Excel export (Arabic columns).
export async function getReportData(
  type: ReportType,
  dateFrom: string,
  dateTo: string,
): Promise<ReportSection[]> {
  const scope = await requireModuleScope("reports")
  // العزل بين المؤسسات صارم؛ وداخل المؤسسة: المدير يصدّر تقارير كل المؤسسة والموظف تقاريره فقط.
  const from = (dateFrom || "").slice(0, 10)
  const to = (dateTo || "").slice(0, 10)
  const sections: ReportSection[] = []

  if (type === "incidents" || type === "all") {
    const rows = await db
      .select()
      .from(incident)
      .where(scopeWhere({ organizationId: incident.organizationId, userId: incident.userId }, scope))
      .orderBy(desc(incident.createdAt))
    const filtered = rows.filter((r) => inRange(r.incidentDate ?? null, from, to))
    sections.push({
      key: "incidents",
      title: "تقرير الحوادث",
      columns: [
        { key: "documentNo", label: "رقم الحادثة" },
        { key: "title", label: "نوع الحادثة" },
        { key: "location", label: "الموقع" },
        { key: "incidentDate", label: "التاريخ" },
        { key: "severity", label: "الخطورة" },
        { key: "status", label: "الحالة" },
        { key: "reportedBy", label: "المُبلِّغ" },
      ],
      rows: filtered.map((r) => ({
        documentNo: r.documentNo || "-",
        title: r.title || "-",
        location: r.location || "-",
        incidentDate: r.incidentDate ?? "-",
        severity: severityLabels[r.severity ?? ""] ?? r.severity ?? "-",
        status: statusLabels[r.status ?? ""] ?? r.status ?? "-",
        reportedBy: r.reportedBy || "-",
      })),
    })
  }

  if (type === "violations" || type === "all") {
    const rows = await db
      .select()
      .from(violation)
      .where(scopeWhere({ organizationId: violation.organizationId, userId: violation.userId }, scope))
      .orderBy(desc(violation.createdAt))
    const filtered = rows.filter((r) => inRange(r.violationDate ?? null, from, to))
    sections.push({
      key: "violations",
      title: "تقرير المخالفات",
      columns: [
        { key: "documentNo", label: "رقم المخالفة" },
        { key: "employeeName", label: "اسم الموظف" },
        { key: "violationType", label: "نوع المخالفة" },
        { key: "violationDate", label: "التاريخ" },
        { key: "category", label: "التصنيف" },
        { key: "status", label: "الحالة" },
      ],
      rows: filtered.map((r) => ({
        documentNo: r.documentNo || "-",
        employeeName: r.employeeName || "-",
        violationType: r.violationType || "-",
        violationDate: r.violationDate ?? "-",
        category: r.category === "external" ? "خارجية" : "داخلية",
        status: statusLabels[effectiveViolationStatus(r)] ?? "-",
      })),
    })
  }

  if (type === "inspections" || type === "all") {
    const rows = await db
      .select()
      .from(inspection)
      .where(scopeWhere({ organizationId: inspection.organizationId, userId: inspection.userId }, scope))
      .orderBy(desc(inspection.createdAt))
    const filtered = rows.filter((r) => inRange(r.inspectionDate ?? null, from, to))
    sections.push({
      key: "inspections",
      title: "تقرير التفتيش",
      columns: [
        { key: "title", label: "عنوان التفتيش" },
        { key: "area", label: "المنطقة" },
        { key: "inspector", label: "المفتّش" },
        { key: "inspectionDate", label: "التاريخ" },
        { key: "compliance", label: "نسبة الامتثال %" },
        { key: "findings", label: "الملاحظات" },
        { key: "status", label: "الحالة" },
      ],
      rows: filtered.map((r) => ({
        title: r.title || "-",
        area: r.area || "-",
        inspector: r.inspector || "-",
        inspectionDate: r.inspectionDate ?? "-",
        compliance: r.compliance ?? 0,
        findings: r.findings ?? 0,
        status: statusLabels[r.status ?? ""] ?? r.status ?? "-",
      })),
    })
  }

  if (type === "observations" || type === "all") {
    const rows = await db
      .select()
      .from(observation)
      .where(
        scopeWhere(
          { organizationId: observation.organizationId, userId: observation.userId },
          scope,
          eq(observation.kind, "observation"),
        ),
      )
      .orderBy(desc(observation.createdAt))
    const filtered = rows.filter((r) => inRange(r.observationDate ?? null, from, to))
    sections.push({
      key: "observations",
      title: "تقرير الملاحظات الوشيكة",
      columns: [
        { key: "documentNo", label: "رقم الملاحظة" },
        { key: "description", label: "الوصف" },
        { key: "location", label: "الموقع" },
        { key: "observationDate", label: "التاريخ" },
        { key: "observedBy", label: "المُسجِّل" },
        { key: "status", label: "الحالة" },
      ],
      rows: filtered.map((r) => ({
        documentNo: r.documentNo || "-",
        description: r.description || "-",
        location: r.location || "-",
        observationDate: r.observationDate ?? "-",
        observedBy: r.observedBy || "-",
        status: statusLabels[r.status ?? ""] ?? r.status ?? "-",
      })),
    })
  }

  if (type === "positives" || type === "all") {
    const rows = await db
      .select()
      .from(observation)
      .where(
        scopeWhere(
          { organizationId: observation.organizationId, userId: observation.userId },
          scope,
          eq(observation.kind, "positive"),
        ),
      )
      .orderBy(desc(observation.createdAt))
    const filtered = rows.filter((r) => inRange(r.observationDate ?? null, from, to))
    sections.push({
      key: "positives",
      title: "تقرير الملاحظات الإيجابية",
      columns: [
        { key: "documentNo", label: "رقم الملاح��ة" },
        { key: "description", label: "الوصف" },
        { key: "location", label: "الموقع" },
        { key: "observationDate", label: "التاريخ" },
        { key: "observedBy", label: "المُسجِّل" },
      ],
      rows: filtered.map((r) => ({
        documentNo: r.documentNo || "-",
        description: r.description || "-",
        location: r.location || "-",
        observationDate: r.observationDate ?? "-",
        observedBy: r.observedBy || "-",
      })),
    })
  }

  return sections
}
