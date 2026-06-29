"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  company,
  incident,
  inspection,
  permit,
  risk,
  training,
  trainingAttendee,
  correctiveAction,
  audit,
  document,
  violation,
  attachment,
  user,
} from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { requireModuleUserId } from "@/lib/session"
import { severityLabels, statusLabels } from "@/lib/labels"
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

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
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
  const userId = await getUserId()
  const rows = await db.select().from(company).where(eq(company.userId, userId)).limit(1)
  return rows[0] ?? null
}

export async function saveCompany(formData: FormData) {
  const userId = await getUserId()
  const existing = await db.select().from(company).where(eq(company.userId, userId)).limit(1)
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
    await db.update(company).set(values).where(and(eq(company.id, existing[0].id), eq(company.userId, userId)))
  } else {
    await db.insert(company).values({ userId, ...values })
  }
  revalidatePath("/settings")
  revalidatePath("/")
}

/* ---------------- Incidents ---------------- */
export async function getIncidents() {
  const userId = await getUserId()
  return db.select().from(incident).where(eq(incident.userId, userId)).orderBy(desc(incident.createdAt))
}
export async function createIncident(formData: FormData) {
  const userId = await requireModuleUserId("incidents")
  await db.insert(incident).values({
    userId,
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
  const userId = await requireModuleUserId("incidents")

  const title = str(formData.get("title")).trim()
  if (!title) throw new Error("نوع الحادثة مطلوب")

  // Auto document number: INC-YYYY-### (sequence resets each year).
  const year = new Date().getFullYear()
  const existing = await db
    .select({ documentNo: incident.documentNo })
    .from(incident)
    .where(eq(incident.userId, userId))
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
      documentNo,
      title,
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
      await saveDataUrlAttachment(userId, "incidents", recordId, sig.kind, sig.value, sig.name)
    }
  }

  // Persist site photos (JSON array of base64 data URLs) as photo attachments.
  try {
    const sitePhotos = JSON.parse(str(formData.get("sitePhotos"), "[]")) as string[]
    for (let i = 0; i < sitePhotos.length; i++) {
      if (typeof sitePhotos[i] === "string" && sitePhotos[i].startsWith("data:image")) {
        await saveDataUrlAttachment(userId, "incidents", recordId, "photo", sitePhotos[i], `site-${i + 1}`)
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
        await saveDataUrlAttachment(userId, "incidents", recordId, "photo", injuryPhotos[i], `injury-party-${i + 1}`)
      }
    }
  } catch {
    // ignore malformed payloads
  }

  revalidatePath("/incidents")
  revalidatePath("/")
  return { documentNo }
}
export async function deleteIncident(id: number) {
  const userId = await requireModuleUserId("incidents")
  await db.delete(incident).where(and(eq(incident.id, id), eq(incident.userId, userId)))
  revalidatePath("/incidents")
  revalidatePath("/")
}

/* ---------------- Inspections ---------------- */
export async function getInspections() {
  const userId = await getUserId()
  return db.select().from(inspection).where(eq(inspection.userId, userId)).orderBy(desc(inspection.createdAt))
}
export async function createInspection(formData: FormData) {
  const userId = await requireModuleUserId("inspections")
  await db.insert(inspection).values({
    userId,
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
  const userId = await requireModuleUserId("inspections")
  await db.delete(inspection).where(and(eq(inspection.id, id), eq(inspection.userId, userId)))
  revalidatePath("/inspections")
}

/* ---------------- Permits ---------------- */
export async function getPermits() {
  const userId = await getUserId()
  return db.select().from(permit).where(eq(permit.userId, userId)).orderBy(desc(permit.createdAt))
}
export async function createPermit(formData: FormData) {
  const userId = await requireModuleUserId("permits")
  await db.insert(permit).values({
    userId,
    title: str(formData.get("title")),
    type: str(formData.get("type"), "hot_work"),
    location: str(formData.get("location")),
    requestedBy: str(formData.get("requestedBy")),
    status: str(formData.get("status"), "pending"),
    validFrom: dateOrNull(formData.get("validFrom")),
    validTo: dateOrNull(formData.get("validTo")),
  })
  revalidatePath("/permits")
  revalidatePath("/")
}
export async function deletePermit(id: number) {
  const userId = await requireModuleUserId("permits")
  await db.delete(permit).where(and(eq(permit.id, id), eq(permit.userId, userId)))
  revalidatePath("/permits")
}

/* ---------------- Risks ---------------- */
export async function getRisks() {
  const userId = await getUserId()
  return db.select().from(risk).where(eq(risk.userId, userId)).orderBy(desc(risk.createdAt))
}
export async function createRisk(formData: FormData) {
  const userId = await requireModuleUserId("risks")
  await db.insert(risk).values({
    userId,
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
  const userId = await requireModuleUserId("risks")
  await db.delete(risk).where(and(eq(risk.id, id), eq(risk.userId, userId)))
  revalidatePath("/risks")
}

/* ---------------- Training ---------------- */
export async function getTrainings() {
  const userId = await getUserId()
  return db.select().from(training).where(eq(training.userId, userId)).orderBy(desc(training.createdAt))
}
export async function createTraining(formData: FormData) {
  const userId = await requireModuleUserId("training")
  await db.insert(training).values({
    userId,
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
  const userId = await requireModuleUserId("training")

  const title = str(formData.get("title")).trim()
  if (!title) throw new Error("اسم الدورة مطلوب")

  const trainerSignature = str(formData.get("trainerSignature"))

  const [inserted] = await db
    .insert(training)
    .values({
      userId,
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

  // Keep the cached attendee count on the training row in sync.
  await db.update(training).set({ attendees: cleaned.length }).where(eq(training.id, trainingId))

  // Persist trainer signature as an attachment (same pattern as violations).
  if (trainerSignature.startsWith("data:image")) {
    await saveDataUrlAttachment(userId, "training", trainingId, "signature:trainer", trainerSignature, "trainer-signature")
  }

  revalidatePath("/training")
  return { trainingId }
}

export async function getTrainingAttendees(trainingId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(trainingAttendee)
    .where(and(eq(trainingAttendee.trainingId, trainingId), eq(trainingAttendee.userId, userId)))
    .orderBy(trainingAttendee.rowNo)
}

// All attendees for the current user, grouped by trainingId (for the list page).
export async function getAllTrainingAttendees() {
  const userId = await getUserId()
  const rows = await db
    .select()
    .from(trainingAttendee)
    .where(eq(trainingAttendee.userId, userId))
    .orderBy(trainingAttendee.rowNo)
  const map: Record<number, typeof rows> = {}
  for (const r of rows) {
    ;(map[r.trainingId] ??= []).push(r)
  }
  return map
}

export async function deleteTraining(id: number) {
  const userId = await requireModuleUserId("training")
  await db.delete(trainingAttendee).where(and(eq(trainingAttendee.trainingId, id), eq(trainingAttendee.userId, userId)))
  await db.delete(training).where(and(eq(training.id, id), eq(training.userId, userId)))
  revalidatePath("/training")
}


/* ---------------- Corrective actions ---------------- */
export async function getActions() {
  const userId = await getUserId()
  return db.select().from(correctiveAction).where(eq(correctiveAction.userId, userId)).orderBy(desc(correctiveAction.createdAt))
}
export async function createAction(formData: FormData) {
  const userId = await requireModuleUserId("actions")
  await db.insert(correctiveAction).values({
    userId,
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
  const userId = await requireModuleUserId("actions")
  await db.delete(correctiveAction).where(and(eq(correctiveAction.id, id), eq(correctiveAction.userId, userId)))
  revalidatePath("/actions")
}

/* ---------------- Audits ---------------- */
export async function getAudits() {
  const userId = await getUserId()
  return db.select().from(audit).where(eq(audit.userId, userId)).orderBy(desc(audit.createdAt))
}
export async function createAudit(formData: FormData) {
  const userId = await requireModuleUserId("audits")
  await db.insert(audit).values({
    userId,
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
  const userId = await requireModuleUserId("audits")
  await db.delete(audit).where(and(eq(audit.id, id), eq(audit.userId, userId)))
  revalidatePath("/audits")
}

/* ---------------- Documents ---------------- */
export async function getDocuments() {
  const userId = await getUserId()
  return db.select().from(document).where(eq(document.userId, userId)).orderBy(desc(document.createdAt))
}
export async function createDocument(formData: FormData) {
  const userId = await requireModuleUserId("documents")
  await db.insert(document).values({
    userId,
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
  const userId = await requireModuleUserId("documents")
  await db.delete(document).where(and(eq(document.id, id), eq(document.userId, userId)))
  revalidatePath("/documents")
}

/* ---------------- Violations ---------------- */
export async function getViolations() {
  const userId = await requireModuleUserId("violations")
  const userRows = await db.select({ role: user.role, department: user.department }).from(user).where(eq(user.id, userId)).limit(1)
  const u = userRows[0]
  const isManager =
    u?.role === "admin" ||
    u?.department === "المدير العام" ||
    u?.department === "مفتش السلامة"
  if (isManager) {
    return db.select().from(violation).orderBy(desc(violation.createdAt))
  }
  return db.select().from(violation).where(eq(violation.userId, userId)).orderBy(desc(violation.createdAt))
}

export async function createViolationFull(formData: FormData) {
  const userId = await requireModuleUserId("violations")
  const year = new Date().getFullYear()
  const existing = await db.select({ documentNo: violation.documentNo }).from(violation).orderBy(desc(violation.createdAt))
  const thisYearNos = existing.map((v) => v.documentNo ?? "").filter((n) => n.startsWith(`VIO-${year}-`))
  const maxSeq = thisYearNos.reduce((max, n) => {
    const seq = parseInt(n.split("-")[2] ?? "0", 10)
    return seq > max ? seq : max
  }, 0)
  const documentNo = `VIO-${year}-${String(maxSeq + 1).padStart(3, "0")}`

  const employeeName = str(formData.get("employeeName")).trim()
  if (!employeeName) throw new Error("اسم الموظف مطلوب")

  // Pass every column explicitly so nothing falls back to a DB default.
  const [inserted] = await db
    .insert(violation)
    .values({
      userId,
      documentNo,
      companyName: str(formData.get("companyName")),
      employeeName,
      employeeNo: str(formData.get("employeeNo")),
      nationality: str(formData.get("nationality")),
      violationType: str(formData.get("violationType")),
      category: str(formData.get("category"), "internal"),
      internalAction: str(formData.get("internalAction")),
      violationDate: dateOrNull(formData.get("violationDate")),
      violationTime: str(formData.get("violationTime")),
      place: str(formData.get("place")),
      description: str(formData.get("description")),
      witnesses: str(formData.get("witnesses")),
      evidences: str(formData.get("evidences")),
      proposedAction: str(formData.get("proposedAction")),
      status: str(formData.get("status"), "open"),
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
        await saveDataUrlAttachment(userId, "violations", recordId, "photo", images[i], `evidence-${i + 1}`)
      }
    }
  } catch {
    // ignore malformed image payloads; the violation itself is already saved
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
      await saveDataUrlAttachment(userId, "violations", recordId, sig.kind, sig.value, sig.name)
    }
  }

  revalidatePath("/violations")
  revalidatePath("/")
  return { documentNo }
}

export async function deleteViolation(id: number) {
  const userId = await requireModuleUserId("violations")
  const userRows = await db.select({ role: user.role, department: user.department }).from(user).where(eq(user.id, userId)).limit(1)
  const u = userRows[0]
  const v = await db.select().from(violation).where(eq(violation.id, id)).limit(1)
  if (!v[0]) throw new Error("المخالفة غير موجودة")
  const canDelete =
    u?.role === "admin" ||
    u?.department === "المدير العام" ||
    u?.department === "مفتش السلامة" ||
    v[0].userId === userId
  if (!canDelete) throw new Error("غير مصرح لك بالحذف")
  await db.delete(violation).where(eq(violation.id, id))
  revalidatePath("/violations")
  revalidatePath("/")
}

/* ---------------- Dashboard aggregates ---------------- */
export async function getDashboardData() {
  const userId = await getUserId()
  const [inc, ins, per, rsk, act] = await Promise.all([
    db.select().from(incident).where(eq(incident.userId, userId)),
    db.select().from(inspection).where(eq(inspection.userId, userId)),
    db.select().from(permit).where(eq(permit.userId, userId)),
    db.select().from(risk).where(eq(risk.userId, userId)),
    db.select().from(correctiveAction).where(eq(correctiveAction.userId, userId)),
  ])
  return { incidents: inc, inspections: ins, permits: per, risks: rsk, actions: act }
}

/* ---------------- Reports ---------------- */
export type ReportType = "incidents" | "violations" | "inspections" | "all"

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
  const userId = await requireModuleUserId("reports")
  const from = (dateFrom || "").slice(0, 10)
  const to = (dateTo || "").slice(0, 10)
  const sections: ReportSection[] = []

  if (type === "incidents" || type === "all") {
    const rows = await db.select().from(incident).where(eq(incident.userId, userId)).orderBy(desc(incident.createdAt))
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
    const rows = await db.select().from(violation).where(eq(violation.userId, userId)).orderBy(desc(violation.createdAt))
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
        status: statusLabels[r.status ?? ""] ?? r.status ?? "-",
      })),
    })
  }

  if (type === "inspections" || type === "all") {
    const rows = await db.select().from(inspection).where(eq(inspection.userId, userId)).orderBy(desc(inspection.createdAt))
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

  return sections
}
