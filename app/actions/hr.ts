"use server"

import { db } from "@/lib/db"
import { violation, incident } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireModuleUserId } from "@/lib/session"
import type { IncidentParty } from "@/lib/incident-types"

// القيمة المخزّنة للإجراء الداخلي عند التحويل إلى الموارد البشرية.
const HR_TRANSFER_ACTION = "تحويل إلى الموارد البشرية"

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

// المخالفات الداخلية المحوّلة إلى الموارد البشرية.
export async function getHrViolations() {
  const userId = await requireModuleUserId("hr")
  return db
    .select()
    .from(violation)
    .where(
      and(
        eq(violation.userId, userId),
        eq(violation.category, "internal"),
        eq(violation.internalAction, HR_TRANSFER_ACTION),
      ),
    )
    .orderBy(desc(violation.createdAt))
}

// الحوادث الداخلية التي يكون أحد أطرافها المتضررة "موظف".
export async function getHrIncidents() {
  const userId = await requireModuleUserId("hr")
  const rows = await db
    .select()
    .from(incident)
    .where(eq(incident.userId, userId))
    .orderBy(desc(incident.createdAt))
  return rows.filter((r) => hasEmployeeParty(r.parties))
}

// عدد البنود غير المعالجة (غير المغلقة) للشارة في القائمة الجانبية.
export async function getHrPendingCount(): Promise<number> {
  const [violations, incidents] = await Promise.all([getHrViolations(), getHrIncidents()])
  const pendingViolations = violations.filter((v) => v.status !== "closed").length
  const pendingIncidents = incidents.filter((i) => i.status !== "closed").length
  return pendingViolations + pendingIncidents
}

/* ---------------- تسجيل إجراء الموارد البشرية ---------------- */

export async function updateHrViolation(formData: FormData) {
  const userId = await requireModuleUserId("hr")
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف غير صالح")
  const markDone = str(formData.get("markDone")) === "1"

  await db
    .update(violation)
    .set({
      hrAction: str(formData.get("hrAction")),
      hrActionDate: dateOrNull(formData.get("hrActionDate")),
      hrNotes: str(formData.get("hrNotes")),
      ...(markDone ? { status: "closed" } : {}),
    })
    .where(and(eq(violation.id, id), eq(violation.userId, userId)))

  revalidatePath("/hr")
  revalidatePath("/violations")
  revalidatePath("/")
}

export async function updateHrIncident(formData: FormData) {
  const userId = await requireModuleUserId("hr")
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف غير صالح")
  const markDone = str(formData.get("markDone")) === "1"

  await db
    .update(incident)
    .set({
      hrAction: str(formData.get("hrAction")),
      hrActionDate: dateOrNull(formData.get("hrActionDate")),
      hrNotes: str(formData.get("hrNotes")),
      ...(markDone ? { status: "closed" } : {}),
    })
    .where(and(eq(incident.id, id), eq(incident.userId, userId)))

  revalidatePath("/hr")
  revalidatePath("/incidents")
  revalidatePath("/")
}
