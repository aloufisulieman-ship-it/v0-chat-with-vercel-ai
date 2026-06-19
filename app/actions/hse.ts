"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { requireModuleUserId, requireUser } from "@/lib/session"

// ---------- FormData helpers ----------
function str(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v.trim() : ""
}
function num(fd: FormData, key: string): number {
  const v = fd.get(key)
  const n = typeof v === "string" ? Number.parseInt(v, 10) : Number.NaN
  return Number.isFinite(n) ? n : 0
}
function dateOrNull(fd: FormData, key: string): string | null {
  const v = fd.get(key)
  return typeof v === "string" && v.trim() !== "" ? v : null
}

// ========== DASHBOARD ==========

export async function getDashboardData() {
  const user = await requireUser()
  const userId = user.id

  const [incidents, inspections, permits, risks, actions] = await Promise.all([
    db.select().from(schema.incident).where(eq(schema.incident.userId, userId)),
    db.select().from(schema.inspection).where(eq(schema.inspection.userId, userId)),
    db.select().from(schema.permit).where(eq(schema.permit.userId, userId)),
    db.select().from(schema.risk).where(eq(schema.risk.userId, userId)),
    db.select().from(schema.correctiveAction).where(eq(schema.correctiveAction.userId, userId)),
  ])

  return { incidents, inspections, permits, risks, actions }
}

// ========== COMPANY ==========

export async function getCompany() {
  const user = await requireUser()
  const rows = await db
    .select()
    .from(schema.company)
    .where(eq(schema.company.userId, user.id))
    .limit(1)
  return rows[0] ?? null
}

export async function saveCompany(formData: FormData) {
  const user = await requireUser()
  const userId = user.id

  const values = {
    userId,
    name: str(formData, "name"),
    industry: str(formData, "industry"),
    address: str(formData, "address"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    employeeCount: num(formData, "employeeCount"),
    hseManager: str(formData, "hseManager"),
    updatedAt: new Date(),
  }

  const existing = await db
    .select({ id: schema.company.id })
    .from(schema.company)
    .where(eq(schema.company.userId, userId))
    .limit(1)

  if (existing[0]) {
    await db.update(schema.company).set(values).where(eq(schema.company.id, existing[0].id))
  } else {
    await db.insert(schema.company).values(values)
  }

  revalidatePath("/settings")
}

// ========== INCIDENTS ==========

export async function getIncidents() {
  const userId = await requireModuleUserId("incidents")
  return await db
    .select()
    .from(schema.incident)
    .where(eq(schema.incident.userId, userId))
    .orderBy(desc(schema.incident.createdAt))
}

export async function createIncident(formData: FormData) {
  const userId = await requireModuleUserId("incidents")
  await db.insert(schema.incident).values({
    userId,
    title: str(formData, "title"),
    location: str(formData, "location"),
    type: str(formData, "type") || "near_miss",
    severity: str(formData, "severity") || "low",
    status: str(formData, "status") || "open",
    reportedBy: str(formData, "reportedBy"),
    description: str(formData, "description"),
    incidentDate: dateOrNull(formData, "incidentDate"),
  })
  revalidatePath("/incidents")
  revalidatePath("/")
}

export async function deleteIncident(id: number) {
  const userId = await requireModuleUserId("incidents")
  await db.delete(schema.incident).where(and(eq(schema.incident.id, id), eq(schema.incident.userId, userId)))
  revalidatePath("/incidents")
  revalidatePath("/")
}

// ========== INSPECTIONS ==========

export async function getInspections() {
  const userId = await requireModuleUserId("inspections")
  return await db
    .select()
    .from(schema.inspection)
    .where(eq(schema.inspection.userId, userId))
    .orderBy(desc(schema.inspection.createdAt))
}

export async function createInspection(formData: FormData) {
  const userId = await requireModuleUserId("inspections")
  await db.insert(schema.inspection).values({
    userId,
    title: str(formData, "title"),
    area: str(formData, "area"),
    inspector: str(formData, "inspector"),
    status: str(formData, "status") || "scheduled",
    compliance: num(formData, "compliance"),
    findings: num(formData, "findings"),
    inspectionDate: dateOrNull(formData, "inspectionDate"),
  })
  revalidatePath("/inspections")
  revalidatePath("/")
}

export async function deleteInspection(id: number) {
  const userId = await requireModuleUserId("inspections")
  await db.delete(schema.inspection).where(and(eq(schema.inspection.id, id), eq(schema.inspection.userId, userId)))
  revalidatePath("/inspections")
  revalidatePath("/")
}

// ========== PERMITS ==========

export async function getPermits() {
  const userId = await requireModuleUserId("permits")
  return await db
    .select()
    .from(schema.permit)
    .where(eq(schema.permit.userId, userId))
    .orderBy(desc(schema.permit.createdAt))
}

export async function createPermit(formData: FormData) {
  const userId = await requireModuleUserId("permits")
  await db.insert(schema.permit).values({
    userId,
    title: str(formData, "title"),
    type: str(formData, "type") || "hot_work",
    location: str(formData, "location"),
    requestedBy: str(formData, "requestedBy"),
    status: str(formData, "status") || "pending",
    validFrom: dateOrNull(formData, "validFrom"),
    validTo: dateOrNull(formData, "validTo"),
  })
  revalidatePath("/permits")
  revalidatePath("/")
}

export async function deletePermit(id: number) {
  const userId = await requireModuleUserId("permits")
  await db.delete(schema.permit).where(and(eq(schema.permit.id, id), eq(schema.permit.userId, userId)))
  revalidatePath("/permits")
  revalidatePath("/")
}

// ========== RISKS ==========

export async function getRisks() {
  const userId = await requireModuleUserId("risks")
  return await db
    .select()
    .from(schema.risk)
    .where(eq(schema.risk.userId, userId))
    .orderBy(desc(schema.risk.createdAt))
}

export async function createRisk(formData: FormData) {
  const userId = await requireModuleUserId("risks")
  await db.insert(schema.risk).values({
    userId,
    hazard: str(formData, "hazard"),
    activity: str(formData, "activity"),
    likelihood: num(formData, "likelihood") || 1,
    consequence: num(formData, "consequence") || 1,
    controls: str(formData, "controls"),
    owner: str(formData, "owner"),
    status: str(formData, "status") || "open",
  })
  revalidatePath("/risks")
  revalidatePath("/")
}

export async function deleteRisk(id: number) {
  const userId = await requireModuleUserId("risks")
  await db.delete(schema.risk).where(and(eq(schema.risk.id, id), eq(schema.risk.userId, userId)))
  revalidatePath("/risks")
  revalidatePath("/")
}

// ========== TRAINING ==========

export async function getTrainings() {
  const userId = await requireModuleUserId("training")
  return await db
    .select()
    .from(schema.training)
    .where(eq(schema.training.userId, userId))
    .orderBy(desc(schema.training.createdAt))
}

export async function createTraining(formData: FormData) {
  const userId = await requireModuleUserId("training")
  await db.insert(schema.training).values({
    userId,
    title: str(formData, "title"),
    trainer: str(formData, "trainer"),
    attendees: num(formData, "attendees"),
    status: str(formData, "status") || "scheduled",
    trainingDate: dateOrNull(formData, "trainingDate"),
  })
  revalidatePath("/training")
}

export async function deleteTraining(id: number) {
  const userId = await requireModuleUserId("training")
  await db.delete(schema.training).where(and(eq(schema.training.id, id), eq(schema.training.userId, userId)))
  revalidatePath("/training")
}

// ========== PPE ==========

export async function getPpe() {
  const userId = await requireModuleUserId("ppe")
  return await db
    .select()
    .from(schema.ppe)
    .where(eq(schema.ppe.userId, userId))
    .orderBy(desc(schema.ppe.createdAt))
}

export async function createPpe(formData: FormData) {
  const userId = await requireModuleUserId("ppe")
  const inStock = num(formData, "inStock")
  const minLevel = num(formData, "minLevel")
  await db.insert(schema.ppe).values({
    userId,
    name: str(formData, "name"),
    category: str(formData, "category"),
    inStock,
    assigned: num(formData, "assigned"),
    minLevel,
    status: inStock < minLevel ? "low_stock" : "sufficient",
  })
  revalidatePath("/ppe")
}

export async function deletePpe(id: number) {
  const userId = await requireModuleUserId("ppe")
  await db.delete(schema.ppe).where(and(eq(schema.ppe.id, id), eq(schema.ppe.userId, userId)))
  revalidatePath("/ppe")
}

// ========== CORRECTIVE ACTIONS ==========

export async function getActions() {
  const userId = await requireModuleUserId("actions")
  return await db
    .select()
    .from(schema.correctiveAction)
    .where(eq(schema.correctiveAction.userId, userId))
    .orderBy(desc(schema.correctiveAction.createdAt))
}

export async function createAction(formData: FormData) {
  const userId = await requireModuleUserId("actions")
  await db.insert(schema.correctiveAction).values({
    userId,
    title: str(formData, "title"),
    source: str(formData, "source"),
    assignedTo: str(formData, "assignedTo"),
    priority: str(formData, "priority") || "medium",
    status: str(formData, "status") || "open",
    dueDate: dateOrNull(formData, "dueDate"),
  })
  revalidatePath("/actions")
  revalidatePath("/")
}

export async function deleteAction(id: number) {
  const userId = await requireModuleUserId("actions")
  await db
    .delete(schema.correctiveAction)
    .where(and(eq(schema.correctiveAction.id, id), eq(schema.correctiveAction.userId, userId)))
  revalidatePath("/actions")
  revalidatePath("/")
}

// ========== AUDITS ==========

export async function getAudits() {
  const userId = await requireModuleUserId("audits")
  return await db
    .select()
    .from(schema.audit)
    .where(eq(schema.audit.userId, userId))
    .orderBy(desc(schema.audit.createdAt))
}

export async function createAudit(formData: FormData) {
  const userId = await requireModuleUserId("audits")
  await db.insert(schema.audit).values({
    userId,
    title: str(formData, "title"),
    standard: str(formData, "standard"),
    auditor: str(formData, "auditor"),
    score: num(formData, "score"),
    status: str(formData, "status") || "scheduled",
    auditDate: dateOrNull(formData, "auditDate"),
  })
  revalidatePath("/audits")
}

export async function deleteAudit(id: number) {
  const userId = await requireModuleUserId("audits")
  await db.delete(schema.audit).where(and(eq(schema.audit.id, id), eq(schema.audit.userId, userId)))
  revalidatePath("/audits")
}

// ========== DOCUMENTS ==========

export async function getDocuments() {
  const userId = await requireModuleUserId("documents")
  return await db
    .select()
    .from(schema.document)
    .where(eq(schema.document.userId, userId))
    .orderBy(desc(schema.document.createdAt))
}

export async function createDocument(formData: FormData) {
  const userId = await requireModuleUserId("documents")
  await db.insert(schema.document).values({
    userId,
    title: str(formData, "title"),
    category: str(formData, "category"),
    version: str(formData, "version") || "1.0",
    owner: str(formData, "owner"),
    status: str(formData, "status") || "active",
    reviewDate: dateOrNull(formData, "reviewDate"),
  })
  revalidatePath("/documents")
}

export async function deleteDocument(id: number) {
  const userId = await requireModuleUserId("documents")
  await db.delete(schema.document).where(and(eq(schema.document.id, id), eq(schema.document.userId, userId)))
  revalidatePath("/documents")
}

// ========== VIOLATIONS ==========

export async function getViolations() {
  const user = await requireUser()
  const userId = user.id

  if (
    user.role === "admin" ||
    user.department === "المدير العام" ||
    user.department === "مفتش السلامة"
  ) {
    return await db.select().from(schema.violation).orderBy(desc(schema.violation.createdAt))
  }

  return await db
    .select()
    .from(schema.violation)
    .where(eq(schema.violation.userId, userId))
    .orderBy(desc(schema.violation.createdAt))
}

export async function createViolationFull(formData: FormData) {
  const userId = await requireModuleUserId("violations")

  const existing = await db.select({ id: schema.violation.id }).from(schema.violation)
  const count = existing.length + 1
  const documentNo = `MHS-IMS-PR-HSE-${String(count).padStart(3, "0")}`

  // The form sends a "violationType" value but the table stores the descriptive text;
  // fold it into the description so no information is lost.
  const violationType = str(formData, "violationType")
  const baseDescription = str(formData, "description")
  const description = [violationType, baseDescription].filter(Boolean).join(" - ")

  await db.insert(schema.violation).values({
    userId,
    documentNo,
    employeeName: str(formData, "employeeName"),
    employeeNo: str(formData, "employeeNo"),
    nationality: str(formData, "nationality"),
    companyName: str(formData, "companyName"),
    violationDate: dateOrNull(formData, "violationDate"),
    violationTime: str(formData, "violationTime"),
    place: str(formData, "place"),
    description,
    witnesses: str(formData, "witnesses"),
    evidences: str(formData, "evidences"),
    proposedAction: str(formData, "proposedAction"),
    editorSignature: str(formData, "editorSignature"),
    violatorSignature: str(formData, "violatorSignature"),
    managerSignature: str(formData, "managerSignature"),
    status: str(formData, "status") || "open",
  })

  revalidatePath("/violations")
  return { documentNo }
}

export async function deleteViolation(id: number) {
  const user = await requireModuleUserId("violations")
  const userId = user

  const current = await requireUser()
  const rows = await db.select().from(schema.violation).where(eq(schema.violation.id, id)).limit(1)
  const violation = rows[0]

  if (!violation) throw new Error("المخالفة غير موجودة")

  const canDelete =
    current.role === "admin" ||
    current.department === "المدير العام" ||
    current.department === "مفتش السلامة" ||
    violation.userId === userId

  if (!canDelete) throw new Error("غير مصرح لك بالحذف")

  await db.delete(schema.violation).where(eq(schema.violation.id, id))
  revalidatePath("/violations")
}
