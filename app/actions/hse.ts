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
} from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
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
import { put } from "@vercel/blob"

// Convert a base64 data URL (e.g. "data:image/png;base64,....") into a Blob.
function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  const contentType = match[1]
  const bytes = Buffer.from(match[2], "base64")
  const ext = contentType.split("/")[1]?.split("+")[0] || "png"
  return { blob: new Blob([bytes], { type: contentType }), ext }
}

// Upload one base64 data URL as an attachment row tied to a record.
async function saveDataUrlAttachment(
  userId: string,
  organizationId: string,
  module: string,
  recordId: number,
  kind: string,
  dataUrl: string,
  baseName: string,
) {
  const parsed = dataUrlToBlob(dataUrl)
  if (!parsed) return
  const filename = `${baseName}.${parsed.ext}`
  const key = `hse/${userId}/${module}/${recordId}/${Date.now()}-${filename}`
  const uploaded = await put(key, parsed.blob, { access: "private", addRandomSuffix: true })
  await db.insert(attachment).values({
    userId,
    organizationId,
    module,
    recordId,
    kind,
    pathname: uploaded.pathname,
    url: uploaded.url,
    filename,
    contentType: parsed.blob.type,
    size: parsed.blob.size,
  })
}

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

  const routedTo = str(formData.get("routedTo"))
  if (routedTo !== "hr" && routedTo !== "finance") {
    throw new Error("يجب اختيار جهة تحويل الحادثة: الموارد البشرية أو المالية")
  }

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
    })
    .returning({ id: incident.id })

  const recordId = inserted.id

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

// يحدد ما إذا كان المستخدم يملك صلاحية اعتماد/رفض التصاريح (مدير).
function isPermitApprover(role: string, department: string): boolean {
  return role === "admin" || department === "المدير العام" || department === "مفتش السلامة"
}

// اعتماد أو رفض تصريح عمل من قِبل المدير، مع تسجيل اسم المعتمِد والتاريخ والسب��.
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

/* ---------------- Violations ---------------- */
export async function getViolations() {
  const scope = await requireModuleScope("violations")
  return db
    .select()
    .from(violation)
    .where(scopeWhere({ organizationId: violation.organizationId, userId: violation.userId }, scope))
    .orderBy(desc(violation.createdAt))
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

  // مسار إحالة حصري حسب التصنيف: الداخلية → الموارد البشرية، الخارجية → المالية.
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
    })
    .returning({ id: violation.id })

  const recordId = inserted.id

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
    // مُحوّل مسبقاً — أعد رقم المخالفة القائم دون إنشاء تكرار.
    return { documentNo: det.linkedViolationNo }
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
      violationDate: now.toISOString().slice(0, 10),
      violationTime: now.toTimeString().slice(0, 5),
      place: det.cameraLocation || "",
      description,
      status: "open",
      hrStatus: isExternal ? null : "pending",
      financeStatus: isExternal ? "pending" : null,
      settlementNumber: "",
    })
    .returning({ id: violation.id })

  const recordId = inserted.id

  // أرفق لقطة الإثبات كمرفق صورة للمخالفة — أفضل جهد لا يُفشل العملية.
  // اللقطات تُخزَّن في ai_detections.snapshotUrl كـ data URL بصيغة base64 (ناتج
  // canvas.toDataURL من الكاميرا)، لا كرابط http. لذا نمرّرها مباشرةً إلى
  // saveDataUrlAttachment التي ترفعها إلى Blob وتحفظ رابط URL فقط في جدول المرفقات
  // (لا يُخزَّن الـ base64 الضخم في قاعدة البيانات). ندعم أيضاً حالة رابط http
  // القديمة كخيار احتياطي بجلبها وتحويلها إلى data URL.
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
  await db
    .update(aiDetection)
    .set({ status: "converted", linkedViolationNo: documentNo, resolvedBy: actor })
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
export async function getDashboardData() {
  const scope = await requireScope()
  // العزل بين المؤسسات صارم (organizationId دائماً)؛ وداخل المؤسسة يرى المديرُ كل
  // السجلات والموظفُ سجلاته فقط عبر scopeWhere.
  const [inc, ins, per, rsk, act, obs, vio] = await Promise.all([
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
  ])
  return { incidents: inc, inspections: ins, permits: per, risks: rsk, actions: act, observations: obs, violations: vio }
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
        { key: "documentNo", label: "رقم الملاحظة" },
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
