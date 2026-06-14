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
  ppe,
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
export async function deleteTraining(id: number) {
  const userId = await requireModuleUserId("training")
  await db.delete(training).where(and(eq(training.id, id), eq(training.userId, userId)))
  revalidatePath("/training")
}

/* ---------------- PPE ---------------- */
export async function getPpe() {
  const userId = await getUserId()
  return db.select().from(ppe).where(eq(ppe.userId, userId)).orderBy(desc(ppe.createdAt))
}
export async function createPpe(formData: FormData) {
  const userId = await requireModuleUserId("ppe")
  await db.insert(ppe).values({
    userId,
    name: str(formData.get("name")),
    category: str(formData.get("category")),
    inStock: num(formData.get("inStock")),
    assigned: num(formData.get("assigned")),
    minLevel: num(formData.get("minLevel")),
    status: str(formData.get("status"), "sufficient"),
  })
  revalidatePath("/ppe")
}
export async function deletePpe(id: number) {
  const userId = await requireModuleUserId("ppe")
  await db.delete(ppe).where(and(eq(ppe.id, id), eq(ppe.userId, userId)))
  revalidatePath("/ppe")
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
  const userRows = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  const u = userRows[0] as any
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
  const userRows = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  const u = userRows[0] as any
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
