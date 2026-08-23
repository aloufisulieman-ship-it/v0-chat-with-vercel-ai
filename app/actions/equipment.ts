"use server"

import { db } from "@/lib/db"
import { equipment, safetyRule } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireScope, assertWritable } from "@/lib/session"

function str(v: FormDataEntryValue | null, fallback = "") {
  return typeof v === "string" ? v : fallback
}

/* ---------------- سجل المعدات ---------------- */

export async function getEquipment() {
  const { userId, organizationId } = await requireScope()
  return db
    .select()
    .from(equipment)
    .where(and(eq(equipment.organizationId, organizationId), eq(equipment.userId, userId)))
    .orderBy(equipment.equipmentType, equipment.plateNumber)
}

function equipmentValues(formData: FormData) {
  const plateNumber = str(formData.get("plateNumber")).trim()
  if (!plateNumber) throw new Error("لوحة المركبة حقل مطلوب")
  return {
    plateNumber,
    equipmentType: str(formData.get("equipmentType"), "forklift").trim() || "forklift",
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
  const { userId, organizationId } = await requireScope()
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف المعدة غير صالح")
  await db
    .update(equipment)
    .set(equipmentValues(formData))
    .where(and(eq(equipment.id, id), eq(equipment.organizationId, organizationId), eq(equipment.userId, userId)))
  revalidatePath("/equipment")
  revalidatePath("/violations")
}

export async function deleteEquipment(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireScope()
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف المعدة غير صالح")
  await db
    .delete(equipment)
    .where(and(eq(equipment.id, id), eq(equipment.organizationId, organizationId), eq(equipment.userId, userId)))
  revalidatePath("/equipment")
  revalidatePath("/violations")
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
