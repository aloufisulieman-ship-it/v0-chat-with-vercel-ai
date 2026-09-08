"use server"

import { db } from "@/lib/db"
import { equipment, safetyRule, violation, incident, inspection } from "@/lib/db/schema"
import { and, eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireScope, assertWritable } from "@/lib/session"

function str(v: FormDataEntryValue | null, fallback = "") {
  return typeof v === "string" ? v : fallback
}

// تاريخ ISO (YYYY-MM-DD) أو null للحقول الفارغة — أعمدة date في المخطط تقبل null.
function dateOrNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : ""
  return s || null
}

// عدد صحيح موجب أو null (سنة الصنع).
function intOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(typeof v === "string" ? v.trim() : "")
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

/* ---------------- سجل المعدات ---------------- */

export async function getEquipment() {
  // سجل الأسطول أصل مشترك على مستوى المؤسسة (يراه كل مستخدمي المؤسسة)، لذا العزل
  // على organizationId فقط دون تقييد بالمستخدم المنشئ.
  const { organizationId } = await requireScope()
  return db
    .select()
    .from(equipment)
    .where(eq(equipment.organizationId, organizationId))
    .orderBy(equipment.fleetNo, equipment.plateNumber)
}

function equipmentValues(formData: FormData) {
  // في سجل الأسطول رقم الأسطول هو المُعرّف التشغيلي المطلوب؛ اللوحة اختيارية (بعض
  // المعدات كالرافعات لا تحمل لوحة مرور رسمية). نقبل أياً منهما كحدّ أدنى.
  const fleetNo = str(formData.get("fleetNo")).trim()
  const plateNumber = str(formData.get("plateNumber")).trim()
  if (!fleetNo && !plateNumber) throw new Error("رقم الأسطول أو لوحة المركبة حقل مطلوب")
  return {
    fleetNo,
    plateNumber,
    equipmentType: str(formData.get("equipmentType"), "forklift").trim() || "forklift",
    manufacturer: str(formData.get("manufacturer")).trim(),
    model: str(formData.get("model")).trim(),
    serialNumber: str(formData.get("serialNumber")).trim(),
    yearMade: intOrNull(formData.get("yearMade")),
    capacity: str(formData.get("capacity")).trim(),
    operationalStatus: str(formData.get("operationalStatus"), "operational").trim() || "operational",
    location: str(formData.get("location")).trim(),
    purchaseDate: dateOrNull(formData.get("purchaseDate")),
    lastInspectionDate: dateOrNull(formData.get("lastInspectionDate")),
    nextInspectionDate: dateOrNull(formData.get("nextInspectionDate")),
    ownerCompany: str(formData.get("ownerCompany")).trim(),
    driverName: str(formData.get("driverName")).trim(),
    internalCode: str(formData.get("internalCode")).trim(),
    notes: str(formData.get("notes")).trim(),
    active: formData.get("active") !== "false",
    updatedAt: new Date(),
  }
}

export async function createEquipment(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireScope()
  await db.insert(equipment).values({ userId, organizationId, ...equipmentValues(formData) })
  revalidatePath("/equipment")
  revalidatePath("/violations")
}

export async function updateEquipment(formData: FormData) {
  await assertWritable()
  const { organizationId } = await requireScope()
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف المعدة غير صالح")
  await db
    .update(equipment)
    .set(equipmentValues(formData))
    .where(and(eq(equipment.id, id), eq(equipment.organizationId, organizationId)))
  revalidatePath("/equipment")
  revalidatePath("/violations")
}

export async function deleteEquipment(formData: FormData) {
  await assertWritable()
  const { organizationId } = await requireScope()
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف المعدة غير صالح")
  await db
    .delete(equipment)
    .where(and(eq(equipment.id, id), eq(equipment.organizationId, organizationId)))
  revalidatePath("/equipment")
  revalidatePath("/violations")
}

// قائمة مختصرة للمعدات لاستخدامها في قوائم الربط المنسدلة (Combobox) داخل نماذج
// المخالفات/الحوادث/التفتيش. تُرجع فقط الحقول اللازمة للعرض والاختيار.
export async function getEquipmentOptions() {
  const { organizationId } = await requireScope()
  const rows = await db
    .select({
      id: equipment.id,
      fleetNo: equipment.fleetNo,
      plateNumber: equipment.plateNumber,
      equipmentType: equipment.equipmentType,
      active: equipment.active,
    })
    .from(equipment)
    .where(eq(equipment.organizationId, organizationId))
    .orderBy(equipment.fleetNo, equipment.plateNumber)
  return rows
}

// تفاصيل معدة واحدة مع سجلاتها المرتبطة (مخالفات/حوادث/تفتيش) لعرضها في بطاقة المعدة.
// العزل صارم على مستوى المؤسسة، والسجلات المرتبطة تُطابَق عبر equipmentId.
export async function getEquipmentById(id: number) {
  const { organizationId } = await requireScope()
  if (!Number.isFinite(id)) return null
  const rows = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, id), eq(equipment.organizationId, organizationId)))
    .limit(1)
  const item = rows[0]
  if (!item) return null

  const [violations, incidents, inspections] = await Promise.all([
    db
      .select({
        id: violation.id,
        documentNo: violation.documentNo,
        violationType: violation.violationType,
        employeeName: violation.employeeName,
        status: violation.status,
        violationDate: violation.violationDate,
      })
      .from(violation)
      .where(and(eq(violation.organizationId, organizationId), eq(violation.equipmentId, id)))
      .orderBy(desc(violation.id)),
    db
      .select({
        id: incident.id,
        documentNo: incident.documentNo,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        incidentDate: incident.incidentDate,
      })
      .from(incident)
      .where(and(eq(incident.organizationId, organizationId), eq(incident.equipmentId, id)))
      .orderBy(desc(incident.id)),
    db
      .select({
        id: inspection.id,
        title: inspection.title,
        status: inspection.status,
        compliance: inspection.compliance,
        inspectionDate: inspection.inspectionDate,
      })
      .from(inspection)
      .where(and(eq(inspection.organizationId, organizationId), eq(inspection.equipmentId, id)))
      .orderBy(desc(inspection.id)),
  ])

  return { item, violations, incidents, inspections }
}

/* ---------------- قواعد السلامة حسب الموقع ---------------- */

export async function getSafetyRules() {
  const { userId, organizationId } = await requireScope()
  return db
    .select()
    .from(safetyRule)
    .where(and(eq(safetyRule.organizationId, organizationId), eq(safetyRule.userId, userId)))
    .orderBy(safetyRule.location)
}

function safetyRuleValues(formData: FormData) {
  const location = str(formData.get("location")).trim()
  if (!location) throw new Error("اسم الموقع حقل مطلوب")
  return {
    location,
    rules: str(formData.get("rules")).trim(),
    active: formData.get("active") !== "false",
    updatedAt: new Date(),
  }
}

export async function createSafetyRule(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireScope()
  await db.insert(safetyRule).values({ userId, organizationId, ...safetyRuleValues(formData) })
  revalidatePath("/safety-rules")
}

export async function updateSafetyRule(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireScope()
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف القاعدة غير صالح")
  await db
    .update(safetyRule)
    .set(safetyRuleValues(formData))
    .where(and(eq(safetyRule.id, id), eq(safetyRule.organizationId, organizationId), eq(safetyRule.userId, userId)))
  revalidatePath("/safety-rules")
}

export async function deleteSafetyRule(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireScope()
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف القاعدة غير صالح")
  await db
    .delete(safetyRule)
    .where(and(eq(safetyRule.id, id), eq(safetyRule.organizationId, organizationId), eq(safetyRule.userId, userId)))
  revalidatePath("/safety-rules")
}
