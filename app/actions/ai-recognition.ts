"use server"

import { db } from "@/lib/db"
import {
  plateRead,
  employeeIdRead,
  tuktukRead,
  employee,
  equipment,
  safetyRule,
  permit,
  user,
  aiMonitoringNotification,
} from "@/lib/db/schema"
import { and, desc, eq, inArray, or } from "drizzle-orm"
import { requireUser, assertWritable } from "@/lib/session"
import { normalizeCode, normalizePlate, type PermitMatchStatus } from "@/lib/ai-recognition"

/* ---------------- عمليات البحث المرجعية (سجلّات القراءة المرجعية داخل المؤسسة) ---------------- */
// المطابقة تجري على مستوى المؤسسة كاملةً (لا تُقيَّد بـ userId) لأن مُشغّل الكاميرا
// غالباً حساب مختلف عن الحساب الذي أدخل سجل الموظفين/التصاريح؛ لكنها مقيّدة دائماً
// بـ organizationId حتى لا تطابق كاميرا مؤسسةٍ موظفي/تصاريح مؤسسة أخرى.

export type EmployeeMatch = {
  id: number
  employeeId: string
  name: string
  department: string
  phone: string
  photoUrl: string
}

// المطابقة تجري على الرقم الوظيفي، أو رقم البطاقة/الكود، أو الرقم المطرّز على اليونيفورم
// (أياً منها يطابق القراءة البصرية). uniformNumber هو المرجع الأساسي لرصد المخالفات.
export async function lookupEmployeeByNumber(organizationId: string, numberRaw: string): Promise<EmployeeMatch | null> {
  const target = normalizeCode(numberRaw)
  if (!target) return null
  const rows = await db
    .select({
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      department: employee.department,
      cardCode: employee.cardCode,
      uniformNumber: employee.uniformNumber,
      phone: employee.phone,
      photoUrl: employee.photoUrl,
    })
    .from(employee)
    .where(eq(employee.organizationId, organizationId))
  const hit = rows.find(
    (r) =>
      normalizeCode(r.uniformNumber || "") === target ||
      normalizeCode(r.employeeId) === target ||
      normalizeCode(r.cardCode || "") === target,
  )
  if (!hit) return null
  return {
    id: hit.id,
    employeeId: hit.employeeId,
    name: hit.name,
    department: hit.department,
    phone: hit.phone || "",
    photoUrl: hit.photoUrl || "",
  }
}

/* ---------------- مطابقة سجل المعدات (عبر لوحة المركبة الرسمية) ---------------- */

export type EquipmentMatch = {
  id: number
  plateNumber: string
  equipmentType: string
  ownerCompany: string
  driverName: string
  internalCode: string
}

export async function lookupEquipmentByPlate(organizationId: string, plateRaw: string): Promise<EquipmentMatch | null> {
  // المطابقة بالرقم الكامل (حروف + أرقام معاً) بعد التطبيع الموحّد، حتى لا تُخلط
  // مركبتان لهما نفس الأرقام لكن برمز حروف مختلف.
  const target = normalizePlate(plateRaw)
  if (!target) return null
  const codeTarget = normalizeCode(plateRaw)
  const rows = await db
    .select({
      id: equipment.id,
      plateNumber: equipment.plateNumber,
      equipmentType: equipment.equipmentType,
      ownerCompany: equipment.ownerCompany,
      driverName: equipment.driverName,
      internalCode: equipment.internalCode,
      active: equipment.active,
    })
    .from(equipment)
    .where(eq(equipment.organizationId, organizationId))
  const hit = rows.find(
    (r) =>
      normalizePlate(r.plateNumber) === target ||
      (Boolean(r.internalCode) && normalizeCode(r.internalCode || "") === codeTarget),
  )
  if (!hit) return null
  return {
    id: hit.id,
    plateNumber: hit.plateNumber,
    equipmentType: hit.equipmentType,
    ownerCompany: hit.ownerCompany || "",
    driverName: hit.driverName || "",
    internalCode: hit.internalCode || "",
  }
}

/* ---------------- قواعد السلامة الخاصة بموقع الكاميرا ---------------- */
// تُرجع نص القواعد الفعّالة المطابقة لاسم الموقع (تطابق جزئي غير حسّاس لحالة الأحرف)
// لتُمرَّر إلى نموذج الرؤية الحاسوبية عند تحكيم السلوك في الإطار.
export async function getSafetyRulesForLocation(organizationId: string, locationRaw: string): Promise<string> {
  const loc = (locationRaw || "").trim().toLowerCase()
  if (!loc) return ""
  const rows = await db
    .select({ location: safetyRule.location, rules: safetyRule.rules, active: safetyRule.active })
    .from(safetyRule)
    .where(and(eq(safetyRule.organizationId, organizationId), eq(safetyRule.active, true)))
  const matches = rows.filter((r) => {
    const rl = (r.location || "").trim().toLowerCase()
    return rl && (rl === loc || loc.includes(rl) || rl.includes(loc))
  })
  return matches
    .map((r) => (r.rules || "").trim())
    .filter(Boolean)
    .join("\n")
}

export type TuktukPermitMatch = {
  id: number
  documentNo: string
  driverName: string
  validTo: string | null
  status: string
  permitStatus: PermitMatchStatus
}

// يحسب حالة التصريح: valid إذا كان معتمداً وسارياً (validTo اليوم أو بعده)، وإلا expired.
function computePermitStatus(status: string, validTo: string | null): PermitMatchStatus {
  const approved = status === "approved"
  if (!approved) return "expired"
  if (!validTo) return "expired"
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const to = new Date(validTo)
  if (Number.isNaN(to.getTime())) return "expired"
  return to.getTime() >= start.getTime() ? "valid" : "expired"
}

export async function lookupTuktukPermit(organizationId: string, numberRaw: string): Promise<TuktukPermitMatch | null> {
  const target = normalizeCode(numberRaw)
  if (!target) return null
  const rows = await db
    .select({
      id: permit.id,
      documentNo: permit.documentNo,
      status: permit.status,
      validTo: permit.validTo,
      requestedBy: permit.requestedBy,
      details: permit.details,
    })
    .from(permit)
    .where(and(eq(permit.organizationId, organizationId), eq(permit.type, "tuktuk")))

  const hit = rows.find((r) => {
    let vehicleNo = ""
    try {
      const d = r.details ? (JSON.parse(r.details) as Record<string, string>) : {}
      vehicleNo = d.vehicleNo || ""
    } catch {
      /* تجاهل JSON التالف */
    }
    return normalizeCode(vehicleNo) === target || normalizeCode(r.documentNo || "") === target
  })
  if (!hit) return null

  let driverName = hit.requestedBy || ""
  try {
    const d = hit.details ? (JSON.parse(hit.details) as Record<string, string>) : {}
    driverName = d.driverName || driverName
  } catch {
    /* تجاهل */
  }
  const validTo = hit.validTo ? String(hit.validTo) : null
  return {
    id: hit.id,
    documentNo: hit.documentNo || "",
    driverName,
    validTo,
    status: hit.status || "",
    permitStatus: computePermitStatus(hit.status || "", validTo),
  }
}

/* ---------------- تخزين القراءات ---------------- */

type BaseReadInput = {
  confidence: number
  imageUrl?: string
  cameraName?: string
  location?: string
}

export async function savePlateRead(
  input: BaseReadInput & { plateNumber: string },
): Promise<{ id: number; match: EquipmentMatch | null }> {
  await assertWritable()
  const { id: userId, organizationId } = await requireUser()
  const match = await lookupEquipmentByPlate(organizationId, input.plateNumber)
  const [row] = await db
    .insert(plateRead)
    .values({
      userId,
      organizationId,
      plateNumber: (input.plateNumber || "").slice(0, 40),
      confidence: input.confidence,
      imageUrl: input.imageUrl || "",
      cameraName: (input.cameraName || "").slice(0, 160),
      location: (input.location || "").slice(0, 200),
    })
    .returning({ id: plateRead.id })
  return { id: row.id, match }
}

export async function saveEmployeeIdRead(
  input: BaseReadInput & { employeeNumber: string },
): Promise<{ id: number; match: EmployeeMatch | null }> {
  await assertWritable()
  const { id: userId, organizationId } = await requireUser()
  const match = await lookupEmployeeByNumber(organizationId, input.employeeNumber)
  const [row] = await db
    .insert(employeeIdRead)
    .values({
      userId,
      organizationId,
      employeeNumber: (input.employeeNumber || "").slice(0, 60),
      matchedEmployeeId: match?.id ?? null,
      confidence: input.confidence,
      imageUrl: input.imageUrl || "",
      cameraName: (input.cameraName || "").slice(0, 160),
      location: (input.location || "").slice(0, 200),
    })
    .returning({ id: employeeIdRead.id })
  return { id: row.id, match }
}

export async function saveTuktukRead(
  input: BaseReadInput & { tuktukNumber: string },
): Promise<{ id: number; match: TuktukPermitMatch | null; permitStatus: PermitMatchStatus }> {
  await assertWritable()
  const { id: userId, organizationId } = await requireUser()
  const match = await lookupTuktukPermit(organizationId, input.tuktukNumber)
  const permitStatus: PermitMatchStatus = match ? match.permitStatus : "not_found"
  const [row] = await db
    .insert(tuktukRead)
    .values({
      userId,
      organizationId,
      tuktukNumber: (input.tuktukNumber || "").slice(0, 40),
      matchedPermitId: match?.id ?? null,
      permitStatus,
      confidence: input.confidence,
      imageUrl: input.imageUrl || "",
      cameraName: (input.cameraName || "").slice(0, 160),
      location: (input.location || "").slice(0, 200),
    })
    .returning({ id: tuktukRead.id })
  return { id: row.id, match, permitStatus }
}

/* ---------------- تنبيه القيادة بدون تصريح ساري (وضع/دمج التوك توك) ---------------- */
// تنبيه مستقل ومتميّز عن المخالفات اليدوية — يُنشأ عند رصد توك توك بتصريح منتهٍ أو
// غير مطابق. يُرسَل لكل المديرين/المسؤولين وأقسام التفتيش/العمليات/غرفة التحكم عبر
// نفس آلية إشعارات المراقبة الذكية (بلا ربط بسجل اكتشاف من الأنواع الستة).
export async function createExpiredPermitAlert(input: {
  tuktukNumber: string
  permitStatus: PermitMatchStatus
  cameraName?: string
  location?: string
  readId: number
}): Promise<void> {
  await assertWritable()
  const { organizationId } = await requireUser()
  // المستقبِلون من نفس المؤسسة فقط.
  const recipients = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.organizationId, organizationId),
        eq(user.status, "approved"),
        or(
          inArray(user.role, ["admin", "manager"]),
          inArray(user.department, ["inspector", "operations", "control_room"]),
        ),
      ),
    )
  if (!recipients.length) return
  const where = input.location || input.cameraName || ""
  const statusText = input.permitStatus === "expired" ? "تصريح منتهٍ" : "بدون تصريح مطابق"
  await db
    .insert(aiMonitoringNotification)
    .values(
      recipients.map((r) => ({
        userId: r.id,
        organizationId,
        detectionId: input.readId,
        title: "قيادة بدون تصريح ساري",
        message: `توك توك رقم ${input.tuktukNumber} (${statusText})${where ? ` — ${where}` : ""}`,
      })),
    )
    .onConflictDoNothing()
}

/* ---------------- قائمة آخر القراءات (موحّدة عبر الأوضاع) ---------------- */

export type UnifiedRead = {
  key: string
  mode: "plate" | "employee_id" | "tuktuk"
  value: string
  confidence: number
  imageUrl: string
  cameraName: string
  location: string
  capturedAt: string
  // نتيجة المطابقة: found/not_found للموظف، valid/expired/not_found للتوك توك، n/a للوحة.
  matchStatus: "found" | "not_found" | "valid" | "expired" | "na"
  matchLabel: string
}

function iso(v: unknown): string {
  return (v as Date)?.toISOString?.() ?? String(v ?? "")
}

export async function getRecentReads(limit = 20): Promise<UnifiedRead[]> {
  const me = await requireUser()
  const organizationId = me.organizationId
  // المدير/الأدمن يرى قراءات كل مؤسسته؛ غيره يرى قراءاته فقط — مع تقييد المؤسسة دائماً.
  const manager = me.role === "admin" || me.role === "manager"
  const cap = Math.min(50, Math.max(1, limit))

  const plateWhere = manager
    ? eq(plateRead.organizationId, organizationId)
    : and(eq(plateRead.organizationId, organizationId), eq(plateRead.userId, me.id))
  const empWhere = manager
    ? eq(employeeIdRead.organizationId, organizationId)
    : and(eq(employeeIdRead.organizationId, organizationId), eq(employeeIdRead.userId, me.id))
  const tukWhere = manager
    ? eq(tuktukRead.organizationId, organizationId)
    : and(eq(tuktukRead.organizationId, organizationId), eq(tuktukRead.userId, me.id))

  const [plates, emps, tuks] = await Promise.all([
    db.select().from(plateRead).where(plateWhere).orderBy(desc(plateRead.capturedAt)).limit(cap),
    db.select().from(employeeIdRead).where(empWhere).orderBy(desc(employeeIdRead.capturedAt)).limit(cap),
    db.select().from(tuktukRead).where(tukWhere).orderBy(desc(tuktukRead.capturedAt)).limit(cap),
  ])

  // مطابقة أسماء الموظفين/سائقي التوك توك للعناصر التي لها معرّف مطابق (للعرض فقط).
  const empIds = [...new Set(emps.map((e) => e.matchedEmployeeId).filter((n): n is number => n != null))]
  const permitIds = [...new Set(tuks.map((t) => t.matchedPermitId).filter((n): n is number => n != null))]

  const empNameById = new Map<number, { name: string; department: string }>()
  if (empIds.length) {
    const rows = await db
      .select({ id: employee.id, name: employee.name, department: employee.department })
      .from(employee)
      .where(and(eq(employee.organizationId, organizationId), inArray(employee.id, empIds)))
    for (const r of rows) empNameById.set(r.id, { name: r.name, department: r.department })
  }
  const permitById = new Map<number, { driverName: string; documentNo: string }>()
  if (permitIds.length) {
    const rows = await db
      .select({ id: permit.id, documentNo: permit.documentNo, requestedBy: permit.requestedBy, details: permit.details })
      .from(permit)
      .where(and(eq(permit.organizationId, organizationId), inArray(permit.id, permitIds)))
    for (const r of rows) {
      let driverName = r.requestedBy || ""
      try {
        const d = r.details ? (JSON.parse(r.details) as Record<string, string>) : {}
        driverName = d.driverName || driverName
      } catch {
        /* تجاهل */
      }
      permitById.set(r.id, { driverName, documentNo: r.documentNo || "" })
    }
  }

  const items: UnifiedRead[] = []
  for (const p of plates) {
    items.push({
      key: `plate-${p.id}`,
      mode: "plate",
      value: p.plateNumber,
      confidence: p.confidence,
      imageUrl: p.imageUrl,
      cameraName: p.cameraName,
      location: p.location,
      capturedAt: iso(p.capturedAt),
      matchStatus: "na",
      matchLabel: "",
    })
  }
  for (const e of emps) {
    const m = e.matchedEmployeeId != null ? empNameById.get(e.matchedEmployeeId) : undefined
    items.push({
      key: `emp-${e.id}`,
      mode: "employee_id",
      value: e.employeeNumber,
      confidence: e.confidence,
      imageUrl: e.imageUrl,
      cameraName: e.cameraName,
      location: e.location,
      capturedAt: iso(e.capturedAt),
      matchStatus: e.matchedEmployeeId != null ? "found" : "not_found",
      matchLabel: m ? `${m.name}${m.department ? ` · ${m.department}` : ""}` : "",
    })
  }
  for (const t of tuks) {
    const m = t.matchedPermitId != null ? permitById.get(t.matchedPermitId) : undefined
    items.push({
      key: `tuk-${t.id}`,
      mode: "tuktuk",
      value: t.tuktukNumber,
      confidence: t.confidence,
      imageUrl: t.imageUrl,
      cameraName: t.cameraName,
      location: t.location,
      capturedAt: iso(t.capturedAt),
      matchStatus: (t.permitStatus as UnifiedRead["matchStatus"]) || "not_found",
      matchLabel: m ? `${m.driverName}${m.documentNo ? ` · ${m.documentNo}` : ""}` : "",
    })
  }

  items.sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : a.capturedAt > b.capturedAt ? -1 : 0))
  return items.slice(0, cap)
}
