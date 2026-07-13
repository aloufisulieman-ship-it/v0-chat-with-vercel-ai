"use server"

import { db } from "@/lib/db"
import { violation, incident } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireModule, requireModuleUserId } from "@/lib/session"
import type { IncidentParty } from "@/lib/incident-types"
import { normalizeHrStatus, type HrStatus } from "@/lib/hr-status"

function str(v: FormDataEntryValue | null, fallback = "") {
  return v == null ? fallback : String(v)
}
function dateOrNull(v: FormDataEntryValue | null) {
  const s = v ? String(v) : ""
  return s ? s : null
}

// هل يضم الحادث طرفاً متضرراً جهته "موظف"؟
function hasEmployeeParty(partiesJson: string | null | undefined): boolean {
  if (!partiesJson) return false
  try {
    const arr = JSON.parse(partiesJson) as IncidentParty[]
    return Array.isArray(arr) && arr.some((p) => p?.affiliation === "employee")
  } catch {
    return false
  }
}

/* ---------------- قراءة البنود المحوّلة ---------------- */

// قائمة مراجعة شاملة: من له صلاحية "hr" يرى كل المخالفات الداخلية بغض النظر عن
// منشئها أو الحالة الرئيسية أو internalAction — يُعتمد على hrStatus للمعالَجة/الإغلاق.
export async function getHrViolations() {
  await requireModuleUserId("hr")
  return db
    .select()
    .from(violation)
    .where(eq(violation.category, "internal"))
    .orderBy(desc(violation.createdAt))
}

// كل الحوادث التي يكون أحد أطرافها المتضررة "موظف" (بغض النظر عن منشئها).
export async function getHrIncidents() {
  await requireModuleUserId("hr")
  const rows = await db
    .select()
    .from(incident)
    .orderBy(desc(incident.createdAt))
  return rows.filter((r) => hasEmployeeParty(r.parties))
}

// عدد البنود غير المعالجة (hrStatus غير مغلق) للشارة في القائمة الجانبية.
export async function getHrPendingCount(): Promise<number> {
  const [violations, incidents] = await Promise.all([getHrViolations(), getHrIncidents()])
  const pendingViolations = violations.filter((v) => normalizeHrStatus(v.hrStatus) !== "closed").length
  const pendingIncidents = incidents.filter((i) => normalizeHrStatus(i.hrStatus) !== "closed").length
  return pendingViolations + pendingIncidents
}

/* ---------------- تسجيل إجراء الموارد البشرية ---------------- */

// يبني قيم التحديث المشتركة لمسار HR من بيانات النموذج،
// مع فرض إلزامية "الإجراء المتخذ" عند الإغلاق وتسجيل من أغلق ومتى.
function buildHrUpdate(formData: FormData, closerName: string) {
  const hrStatus = normalizeHrStatus(str(formData.get("hrStatus"), "pending")) as HrStatus
  const hrAction = str(formData.get("hrAction"))
  const attachment = str(formData.get("hrAttachment")) // JSON array من data URLs

  if (hrStatus === "closed" && !hrAction.trim()) {
    throw new Error("الإجراء المتخذ إلزامي عند إغلاق الحالة")
  }

  // مزامنة حالة السجل الرئيسية مع مسار HR للحفاظ على مؤشرات مفتوح/مغلق.
  const mainStatus = hrStatus === "closed" ? "closed" : hrStatus === "in_review" ? "in_progress" : "open"

  return {
    hrAction,
    hrActionDate: dateOrNull(formData.get("hrActionDate")),
    hrNotes: str(formData.get("hrNotes")),
    hrStatus,
    hrAttachmentUrl: attachment,
    status: mainStatus,
    // سجّل المُغلِق والتاريخ عند الإغلاق فقط؛ وامسحهما إذا أُعيد فتح الحالة.
    hrClosedBy: hrStatus === "closed" ? closerName : "",
    hrClosedAt: hrStatus === "closed" ? new Date() : null,
  }
}

export async function updateHrViolation(formData: FormData) {
  const closer = await requireModule("hr")
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف غير صالح")

  await db
    .update(violation)
    .set(buildHrUpdate(formData, closer.name))
    .where(eq(violation.id, id))

  revalidatePath("/hr")
  revalidatePath("/violations")
  revalidatePath("/")
}

export async function updateHrIncident(formData: FormData) {
  const closer = await requireModule("hr")
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف غير صالح")

  await db
    .update(incident)
    .set(buildHrUpdate(formData, closer.name))
    .where(eq(incident.id, id))

  revalidatePath("/hr")
  revalidatePath("/incidents")
  revalidatePath("/")
}
