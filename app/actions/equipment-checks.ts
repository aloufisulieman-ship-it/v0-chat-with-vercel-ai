"use server"

import { db } from "@/lib/db"
import {
  equipment,
  equipmentChecklistItem,
  equipmentDailyCheck,
  equipmentDailyCheckItem,
  maintenanceTicket,
  correctiveAction,
  permit,
  employee,
  appNotification,
  user,
} from "@/lib/db/schema"
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm"
import { requireScope, requireModuleScope, assertWritable } from "@/lib/session"
import { revalidatePath } from "next/cache"

/* ============================================================================
   الفحص اليومي قبل التشغيل للمعدات (OSHA 1910.178(q)(7) · ISO 45001 §8.1)
   ملاحظات القواعد:
   - أي عيب في بند «حرج للسلامة» يجعل النتيجة «غير صالحة» ويخرج المعدة من الخدمة
     ويفتح تذكرة صيانة؛ ولا تجتاز المعدة فحصاً جديداً حتى تُغلق التذكرة.
   - العيب غير الحرج يبقي المعدة صالحة لكنه يفتح إجراءً تصحيحياً للمتابعة.
   - قبل الاعتماد يتحقق النظام من تصريح قيادة ساري للسائق (نوع forklift).
   ============================================================================ */

// حدود الورديات الثلاث بتوقيت عُمان (Asia/Muscat, UTC+4):
//   الوردية 1: 06:00–14:00 · الوردية 2: 14:00–22:00 · الوردية 3: 22:00–06:00
function shiftForNow(nowUtcMs: number = Date.now()): "1" | "2" | "3" {
  const muscatHour = new Date(nowUtcMs + 4 * 60 * 60 * 1000).getUTCHours()
  if (muscatHour >= 6 && muscatHour < 14) return "1"
  if (muscatHour >= 14 && muscatHour < 22) return "2"
  return "3"
}

// التاريخ الحالي (YYYY-MM-DD) بتوقيت عُمان.
function todayMuscat(): string {
  return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// تطبيع نص عربي لمطابقة الأسماء بمرونة (إزالة التشكيل وتوحيد الألف/الياء/التاء المربوطة).
function normalizeAr(s: string): string {
  return (s || "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/* ---------------- توليد الأكواد التسلسلية ---------------- */

async function nextDpcCode(organizationId: string): Promise<string> {
  const year = new Date().getFullYear()
  const rows = await db
    .select({ code: equipmentDailyCheck.code })
    .from(equipmentDailyCheck)
    .where(eq(equipmentDailyCheck.organizationId, organizationId))
  const maxSeq = rows
    .map((r) => r.code ?? "")
    .filter((c) => c.startsWith(`DPC-${year}-`))
    .reduce((max, c) => {
      const seq = parseInt(c.split("-")[2] ?? "0", 10)
      return seq > max ? seq : max
    }, 0)
  return `DPC-${year}-${String(maxSeq + 1).padStart(5, "0")}`
}

async function nextMtCode(organizationId: string): Promise<string> {
  const year = new Date().getFullYear()
  const rows = await db
    .select({ code: maintenanceTicket.code })
    .from(maintenanceTicket)
    .where(eq(maintenanceTicket.organizationId, organizationId))
  const maxSeq = rows
    .map((r) => r.code ?? "")
    .filter((c) => c.startsWith(`MT-${year}-`))
    .reduce((max, c) => {
      const seq = parseInt(c.split("-")[2] ?? "0", 10)
      return seq > max ? seq : max
    }, 0)
  return `MT-${year}-${String(maxSeq + 1).padStart(4, "0")}`
}

/* ---------------- بنود قائمة الفحص ---------------- */

export type ChecklistItemRow = {
  id: number
  itemCode: string
  labelAr: string
  labelEn: string
  powerScope: string
  isSafetyCritical: boolean
  sortOrder: number
  active: boolean
}

// كل البنود الفعّالة للمؤسسة (لصفحة الإعدادات).
export async function getChecklistItems(): Promise<ChecklistItemRow[]> {
  const { organizationId } = await requireScope()
  const rows = await db
    .select()
    .from(equipmentChecklistItem)
    .where(eq(equipmentChecklistItem.organizationId, organizationId))
    .orderBy(asc(equipmentChecklistItem.sortOrder))
  return rows.map((r) => ({
    id: r.id,
    itemCode: r.itemCode,
    labelAr: r.labelAr,
    labelEn: r.labelEn,
    powerScope: r.powerScope,
    isSafetyCritical: r.isSafetyCritical,
    sortOrder: r.sortOrder,
    active: r.active,
  }))
}

// البنود الظاهرة لنوع طاقة معيّن: المشتركة + الخاصة بنوع الطاقة، الفعّالة فقط.
export async function getChecklistItemsForPower(powerType: string): Promise<ChecklistItemRow[]> {
  const { organizationId } = await requireScope()
  const scope = powerType === "electric" ? "electric" : powerType === "diesel" ? "diesel" : ""
  const scopes = scope ? ["common", scope] : ["common"]
  const rows = await db
    .select()
    .from(equipmentChecklistItem)
    .where(
      and(
        eq(equipmentChecklistItem.organizationId, organizationId),
        eq(equipmentChecklistItem.active, true),
        inArray(equipmentChecklistItem.powerScope, scopes),
      ),
    )
    .orderBy(asc(equipmentChecklistItem.sortOrder))
  return rows.map((r) => ({
    id: r.id,
    itemCode: r.itemCode,
    labelAr: r.labelAr,
    labelEn: r.labelEn,
    powerScope: r.powerScope,
    isSafetyCritical: r.isSafetyCritical,
    sortOrder: r.sortOrder,
    active: r.active,
  }))
}

export async function saveChecklistItem(formData: FormData) {
  await assertWritable()
  const { organizationId } = await requireModuleScope("equipment")
  const id = Number(formData.get("id") || 0)
  const itemCode = String(formData.get("itemCode") || "").trim()
  const labelAr = String(formData.get("labelAr") || "").trim()
  const labelEn = String(formData.get("labelEn") || "").trim()
  const powerScope = String(formData.get("powerScope") || "common")
  const isSafetyCritical = String(formData.get("isSafetyCritical") || "") === "true"
  const sortOrder = Number(formData.get("sortOrder") || 0)
  const active = String(formData.get("active") || "true") === "true"
  if (!itemCode || !labelAr) throw new Error("رمز البند والاسم العربي مطلوبان")

  if (id > 0) {
    await db
      .update(equipmentChecklistItem)
      .set({ labelAr, labelEn, powerScope, isSafetyCritical, sortOrder, active, updatedAt: new Date() })
      .where(and(eq(equipmentChecklistItem.organizationId, organizationId), eq(equipmentChecklistItem.id, id)))
  } else {
    await db
      .insert(equipmentChecklistItem)
      .values({ organizationId, itemCode, labelAr, labelEn, powerScope, isSafetyCritical, sortOrder, active })
      .onConflictDoNothing()
  }
  revalidatePath("/equipment/checklist")
}

export async function toggleChecklistItem(id: number, active: boolean) {
  await assertWritable()
  const { organizationId } = await requireModuleScope("equipment")
  await db
    .update(equipmentChecklistItem)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(equipmentChecklistItem.organizationId, organizationId), eq(equipmentChecklistItem.id, id)))
  revalidatePath("/equipment/checklist")
}

/* ---------------- استرجاع المعدة للفحص ---------------- */

export type CheckEquipmentInfo = {
  id: number
  plateNumber: string
  fleetNo: string
  equipmentType: string
  powerType: string
  manufacturer: string
  model: string
  location: string
  operationalStatus: string
  qrToken: string
  openTicket: { id: number; code: string; title: string } | null
}

async function loadOpenTicket(organizationId: string, equipmentId: number) {
  const [t] = await db
    .select({ id: maintenanceTicket.id, code: maintenanceTicket.code, title: maintenanceTicket.title })
    .from(maintenanceTicket)
    .where(
      and(
        eq(maintenanceTicket.organizationId, organizationId),
        eq(maintenanceTicket.equipmentId, equipmentId),
        inArray(maintenanceTicket.status, ["open", "in_progress"]),
      ),
    )
    .orderBy(desc(maintenanceTicket.createdAt))
    .limit(1)
  return t ?? null
}

function toInfo(e: typeof equipment.$inferSelect, openTicket: CheckEquipmentInfo["openTicket"]): CheckEquipmentInfo {
  return {
    id: e.id,
    plateNumber: e.plateNumber ?? "",
    fleetNo: e.fleetNo ?? "",
    equipmentType: e.equipmentType ?? "",
    powerType: e.powerType ?? "diesel",
    manufacturer: e.manufacturer ?? "",
    model: e.model ?? "",
    location: e.location ?? "",
    operationalStatus: e.operationalStatus ?? "operational",
    qrToken: e.qrToken ?? "",
    openTicket,
  }
}

export async function getEquipmentByQrToken(token: string): Promise<CheckEquipmentInfo | null> {
  const { organizationId } = await requireScope()
  if (!token) return null
  const [e] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.organizationId, organizationId), eq(equipment.qrToken, token)))
    .limit(1)
  if (!e) return null
  return toInfo(e, await loadOpenTicket(organizationId, e.id))
}

export async function getEquipmentForCheck(id: number): Promise<CheckEquipmentInfo | null> {
  const { organizationId } = await requireScope()
  const [e] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.organizationId, organizationId), eq(equipment.id, id)))
    .limit(1)
  if (!e) return null
  return toInfo(e, await loadOpenTicket(organizationId, e.id))
}

// قائمة المعدات القابلة للفحص (اختيار يدوي عند تعذّر مسح QR).
export async function listEquipmentForCheck(): Promise<
  { id: number; plateNumber: string; fleetNo: string; equipmentType: string; powerType: string }[]
> {
  const { organizationId } = await requireScope()
  const rows = await db
    .select({
      id: equipment.id,
      plateNumber: equipment.plateNumber,
      fleetNo: equipment.fleetNo,
      equipmentType: equipment.equipmentType,
      powerType: equipment.powerType,
    })
    .from(equipment)
    .where(and(eq(equipment.organizationId, organizationId), eq(equipment.active, true)))
    .orderBy(asc(equipment.fleetNo))
  return rows.map((r) => ({
    id: r.id,
    plateNumber: r.plateNumber ?? "",
    fleetNo: r.fleetNo ?? "",
    equipmentType: r.equipmentType ?? "",
    powerType: r.powerType ?? "diesel",
  }))
}

/* ---------------- تصريح قيادة السائق ---------------- */

export type OperatorPermitResult = {
  status: "valid" | "expired" | "not_found"
  permitId: number | null
  documentNo: string
  validTo: string | null
}

// يبحث عن تصريح قيادة رافعة شوكية (type=forklift) مطابق لاسم السائق، ويحدّد إن كان
// سارياً اليوم. المطابقة بالاسم المطبّع مقابل requestedBy في التصريح.
export async function resolveOperatorPermit(operatorName: string): Promise<OperatorPermitResult> {
  const { organizationId } = await requireScope()
  const target = normalizeAr(operatorName)
  if (!target) return { status: "not_found", permitId: null, documentNo: "", validTo: null }

  const rows = await db
    .select({
      id: permit.id,
      documentNo: permit.documentNo,
      requestedBy: permit.requestedBy,
      status: permit.status,
      validTo: permit.validTo,
    })
    .from(permit)
    .where(and(eq(permit.organizationId, organizationId), eq(permit.type, "forklift")))

  const matches = rows.filter((r) => {
    const rb = normalizeAr(r.requestedBy ?? "")
    return rb && (rb === target || rb.includes(target) || target.includes(rb))
  })
  if (!matches.length) return { status: "not_found", permitId: null, documentNo: "", validTo: null }

  const today = todayMuscat()
  // نفضّل التصريح الساري (نشط ولم تنتهِ صلاحيته) إن وُجد.
  const valid = matches.find((m) => {
    const notExpired = !m.validTo || String(m.validTo) >= today
    return (m.status === "active" || m.status === "pending") && notExpired
  })
  if (valid) {
    return { status: "valid", permitId: valid.id, documentNo: valid.documentNo ?? "", validTo: valid.validTo ? String(valid.validTo) : null }
  }
  const latest = matches[0]
  return { status: "expired", permitId: latest.id, documentNo: latest.documentNo ?? "", validTo: latest.validTo ? String(latest.validTo) : null }
}

/* ---------------- فحص التكرار في نفس الوردية ---------------- */

export async function findDuplicateCheck(
  equipmentId: number,
  shift: string,
  checkDate: string,
): Promise<{ id: number; code: string; operatorName: string } | null> {
  const { organizationId } = await requireScope()
  const [row] = await db
    .select({ id: equipmentDailyCheck.id, code: equipmentDailyCheck.code, operatorName: equipmentDailyCheck.operatorName })
    .from(equipmentDailyCheck)
    .where(
      and(
        eq(equipmentDailyCheck.organizationId, organizationId),
        eq(equipmentDailyCheck.equipmentId, equipmentId),
        eq(equipmentDailyCheck.shift, shift),
        eq(equipmentDailyCheck.checkDate, checkDate),
      ),
    )
    .limit(1)
  return row ?? null
}

/* ---------------- اعتماد فحص يومي ---------------- */

export type SubmitCheckInput = {
  equipmentId: number
  operatorEmployeeId?: number | null
  operatorName: string
  shift: "1" | "2" | "3"
  hourMeter?: number | null
  entryMethod?: "qr" | "manual"
  location?: string
  notes?: string
  operatorSignatureUrl: string
  // نتائج البنود: تُنسخ التسمية والحرجية من قائمة البنود على الخادم (مصدر الحقيقة).
  items: { itemCode: string; status: "ok" | "defect" | "na"; note?: string; photoUrl?: string }[]
  // السماح بالحفظ رغم وجود فحص سابق في نفس الوردية (بعد تأكيد المستخدم).
  allowDuplicate?: boolean
}

export type SubmitCheckResult = {
  ok: boolean
  checkId?: number
  code?: string
  result?: "fit" | "unfit"
  maintenanceTicketId?: number | null
  maintenanceTicketCode?: string | null
  correctiveActionId?: number | null
  blocked?: "open_ticket" | "permit" | "duplicate"
  message?: string
}

export async function submitDailyCheck(input: SubmitCheckInput): Promise<SubmitCheckResult> {
  await assertWritable()
  const { userId, organizationId } = await requireScope()

  const [eq0] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.organizationId, organizationId), eq(equipment.id, input.equipmentId)))
    .limit(1)
  if (!eq0) return { ok: false, message: "المعدة غير موجودة" }

  // 1) المعدة خارج الخدمة بتذكرة صيانة مفتوحة → تُمنع من فحص جديد حتى تُغلق التذكرة.
  const openTicket = await loadOpenTicket(organizationId, input.equipmentId)
  if (openTicket) {
    return {
      ok: false,
      blocked: "open_ticket",
      maintenanceTicketId: openTicket.id,
      maintenanceTicketCode: openTicket.code,
      message: `المعدة خارج الخدمة بتذكرة صيانة مفتوحة (${openTicket.code}). لا يمكن اعتماد فحص جديد حتى تُغلق التذكرة.`,
    }
  }

  // 2) تصريح قيادة السائق — يجب أن يكون سارياً.
  const permitRes = await resolveOperatorPermit(input.operatorName)
  if (permitRes.status !== "valid") {
    return {
      ok: false,
      blocked: "permit",
      message:
        permitRes.status === "expired"
          ? "تصريح قيادة السائق منتهي الصلاحية — لا يمكن اعتماد الفحص."
          : "لا يوجد تصريح قيادة رافعة شوكية ساري با����م السائق — لا يمكن اعتماد الفحص.",
    }
  }

  // 3) منع تكرار الفحص لنفس المعدة/الوردية/اليوم (ما لم يؤكّد المستخدم).
  const checkDate = todayMuscat()
  if (!input.allowDuplicate) {
    const dup = await findDuplicateCheck(input.equipmentId, input.shift, checkDate)
    if (dup) {
      return {
        ok: false,
        blocked: "duplicate",
        checkId: dup.id,
        code: dup.code,
        message: `يوجد فحص لهذه المعدة في الوردية نفسها اليوم (${dup.code} — ${dup.operatorName}). هل تريد المتابعة؟`,
      }
    }
  }

  // 4) حساب النتيجة من البنود مع نسخ الحرجية والتسمية من قائمة البنود (مصدر الحقيقة).
  const defs = await db
    .select()
    .from(equipmentChecklistItem)
    .where(and(eq(equipmentChecklistItem.organizationId, organizationId), eq(equipmentChecklistItem.active, true)))
  const defByCode = new Map(defs.map((d) => [d.itemCode, d]))

  let hasCriticalDefect = false
  let hasMinorDefect = false
  const defectLabels: string[] = []
  const itemRows = input.items.map((it) => {
    const def = defByCode.get(it.itemCode)
    const critical = def?.isSafetyCritical ?? false
    const label = def?.labelAr ?? it.itemCode
    if (it.status === "defect") {
      if (critical) {
        hasCriticalDefect = true
        defectLabels.push(label)
      } else {
        hasMinorDefect = true
      }
    }
    return {
      organizationId,
      itemCode: it.itemCode,
      labelAr: label,
      status: it.status,
      isSafetyCritical: critical,
      note: it.note ?? "",
      photoUrl: it.photoUrl ?? "",
    }
  })

  const result: "fit" | "unfit" = hasCriticalDefect ? "unfit" : "fit"
  const code = await nextDpcCode(organizationId)

  // 5) إدراج سجل الفحص.
  const [check] = await db
    .insert(equipmentDailyCheck)
    .values({
      code,
      userId,
      organizationId,
      equipmentId: input.equipmentId,
      operatorEmployeeId: input.operatorEmployeeId ?? null,
      operatorName: input.operatorName,
      shift: input.shift,
      checkDate,
      hourMeter: input.hourMeter ?? null,
      powerType: eq0.powerType ?? "diesel",
      result,
      entryMethod: input.entryMethod ?? "qr",
      permitStatus: permitRes.status,
      matchedPermitId: permitRes.permitId,
      operatorSignatureUrl: input.operatorSignatureUrl ?? "",
      location: input.location ?? eq0.location ?? "",
      notes: input.notes ?? "",
    })
    .returning()

  // بنود الفحص.
  if (itemRows.length) {
    await db.insert(equipmentDailyCheckItem).values(itemRows.map((r) => ({ ...r, checkId: check.id })))
  }

  let maintenanceTicketId: number | null = null
  let maintenanceTicketCode: string | null = null
  let correctiveActionId: number | null = null

  const eqLabel = `${eq0.fleetNo || eq0.plateNumber || eq0.id}`

  if (hasCriticalDefect) {
    // 6a) عيب حرج → إخراج المعدة من الخدمة + تذكرة صيانة.
    const mtCode = await nextMtCode(organizationId)
    const [ticket] = await db
      .insert(maintenanceTicket)
      .values({
        code: mtCode,
        userId,
        organizationId,
        equipmentId: input.equipmentId,
        sourceCheckId: check.id,
        title: `عيب حرج في الفحص اليومي — ${eqLabel}`,
        description: `فحص ${code}: عيوب حرجة في: ${defectLabels.join("، ")}. المعدة خارج الخدمة حتى الإصلاح.`,
        priority: "critical",
        status: "open",
        openedBy: input.operatorName,
      })
      .returning()
    maintenanceTicketId = ticket.id
    maintenanceTicketCode = ticket.code

    await db
      .update(equipment)
      .set({ operationalStatus: "out_of_service", updatedAt: new Date() })
      .where(and(eq(equipment.organizationId, organizationId), eq(equipment.id, input.equipmentId)))

    await db
      .update(equipmentDailyCheck)
      .set({ maintenanceTicketId })
      .where(eq(equipmentDailyCheck.id, check.id))

    await notifyManagers(organizationId, "maintenance", ticket.id, {
      title: `معدة خارج الخدمة: ${eqLabel}`,
      message: `فتح تذكرة صيانة ${mtCode} بعد عيب حرج في الفحص اليومي ${code}.`,
    })
  } else if (hasMinorDefect) {
    // 6b) عيب غير حرج → إجراء تصحيحي للمتابعة (المعدة تبقى صالحة).
    const capa = await ensureCapaForCheck(organizationId, userId, check.id, `متابعة عيوب غير حرجة في الفحص اليومي ${code} — ${eqLabel}`)
    correctiveActionId = capa
    if (capa) {
      await db.update(equipmentDailyCheck).set({ correctiveActionId: capa }).where(eq(equipmentDailyCheck.id, check.id))
    }
  }

  revalidatePath("/equipment")
  revalidatePath(`/equipment/${input.equipmentId}`)
  revalidatePath("/equipment/checks")

  return {
    ok: true,
    checkId: check.id,
    code,
    result,
    maintenanceTicketId,
    maintenanceTicketCode,
    correctiveActionId,
  }
}

// إنشاء إجراء تصحيحي مبسّط مربوط بسجل الفحص (بترقيم CAPA تسلسلي للمؤسسة).
async function ensureCapaForCheck(
  organizationId: string,
  userId: string,
  checkId: number,
  title: string,
): Promise<number | null> {
  const year = new Date().getFullYear()
  const existing = await db.select({ code: correctiveAction.code }).from(correctiveAction).where(eq(correctiveAction.organizationId, organizationId))
  const maxSeq = existing
    .map((r) => r.code ?? "")
    .filter((c) => c.startsWith(`CAPA-${year}-`))
    .reduce((max, c) => {
      const seq = parseInt(c.split("-")[2] ?? "0", 10)
      return seq > max ? seq : max
    }, 0)
  const code = `CAPA-${year}-${String(maxSeq + 1).padStart(3, "0")}`
  const due = new Date()
  due.setDate(due.getDate() + 7)
  const [row] = await db
    .insert(correctiveAction)
    .values({
      userId,
      organizationId,
      code,
      title,
      source: "الفحص اليومي للمعدات",
      sourceType: "audit",
      sourceId: checkId,
      assignedTo: "",
      priority: "medium",
      status: "open",
      dueDate: due.toISOString().slice(0, 10),
    })
    .returning({ id: correctiveAction.id })
  return row?.id ?? null
}

// إشعار المديرين/المسؤولين وأقسام العمليات/الصيانة داخل المؤسسة.
async function notifyManagers(
  organizationId: string,
  targetModule: string,
  recordId: number,
  payload: { title: string; message: string },
) {
  await db
    .insert(appNotification)
    .values({
      organizationId,
      targetModule,
      module: "equipment_daily_check",
      recordId,
      title: payload.title,
      message: payload.message,
    })
}

/* ---------------- توقيع المشرف ---------------- */

export async function signCheckBySupervisor(checkId: number, signatureUrl: string) {
  await assertWritable("sign")
  const { userId, organizationId } = await requireScope()
  const [me] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1)
  await db
    .update(equipmentDailyCheck)
    .set({
      supervisorId: userId,
      supervisorName: me?.name ?? "",
      supervisorSignatureUrl: signatureUrl,
      supervisorSignedAt: new Date(),
    })
    .where(and(eq(equipmentDailyCheck.organizationId, organizationId), eq(equipmentDailyCheck.id, checkId)))
  revalidatePath("/equipment/checks")
  revalidatePath(`/equipment/checks/${checkId}`)
}

/* ---------------- تذاكر الصيانة ---------------- */

export async function getMaintenanceTickets(status?: string) {
  const { organizationId } = await requireScope()
  const conds = [eq(maintenanceTicket.organizationId, organizationId)]
  if (status) conds.push(eq(maintenanceTicket.status, status))
  return db
    .select()
    .from(maintenanceTicket)
    .where(and(...conds))
    .orderBy(desc(maintenanceTicket.createdAt))
}

export async function updateMaintenanceTicketStatus(id: number, status: "open" | "in_progress" | "closed", closureNote?: string) {
  await assertWritable()
  const { userId, organizationId } = await requireModuleScope("equipment")
  const [me] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1)

  const [ticket] = await db
    .select()
    .from(maintenanceTicket)
    .where(and(eq(maintenanceTicket.organizationId, organizationId), eq(maintenanceTicket.id, id)))
    .limit(1)
  if (!ticket) throw new Error("التذكرة غير موجودة")

  await db
    .update(maintenanceTicket)
    .set({
      status,
      closedBy: status === "closed" ? me?.name ?? "" : ticket.closedBy,
      closedAt: status === "closed" ? new Date() : null,
      closureNote: closureNote ?? ticket.closureNote,
      updatedAt: new Date(),
    })
    .where(and(eq(maintenanceTicket.organizationId, organizationId), eq(maintenanceTicket.id, id)))

  // عند إغلاق التذكرة تعود المعدة للخدمة (إن لم تكن هناك تذاكر مفتوحة أخرى).
  if (status === "closed") {
    const others = await loadOpenTicket(organizationId, ticket.equipmentId)
    if (!others) {
      await db
        .update(equipment)
        .set({ operationalStatus: "operational", updatedAt: new Date() })
        .where(and(eq(equipment.organizationId, organizationId), eq(equipment.id, ticket.equipmentId)))
    }
  }
  revalidatePath("/equipment/maintenance")
  revalidatePath("/equipment")
}

/* ---------------- سجل الفحوصات ولوحة المتابعة ---------------- */

export type DailyCheckRow = typeof equipmentDailyCheck.$inferSelect

export async function getEquipmentChecks(equipmentId: number): Promise<DailyCheckRow[]> {
  const { organizationId } = await requireScope()
  return db
    .select()
    .from(equipmentDailyCheck)
    .where(and(eq(equipmentDailyCheck.organizationId, organizationId), eq(equipmentDailyCheck.equipmentId, equipmentId)))
    .orderBy(desc(equipmentDailyCheck.createdAt))
}

export async function getDailyCheck(
  id: number,
): Promise<{ check: DailyCheckRow; items: (typeof equipmentDailyCheckItem.$inferSelect)[] } | null> {
  const { organizationId } = await requireScope()
  const [check] = await db
    .select()
    .from(equipmentDailyCheck)
    .where(and(eq(equipmentDailyCheck.organizationId, organizationId), eq(equipmentDailyCheck.id, id)))
    .limit(1)
  if (!check) return null
  const items = await db
    .select()
    .from(equipmentDailyCheckItem)
    .where(eq(equipmentDailyCheckItem.checkId, id))
    .orderBy(asc(equipmentDailyCheckItem.id))
  return { check, items }
}

export async function getRecentChecks(limit = 100): Promise<DailyCheckRow[]> {
  const { organizationId } = await requireScope()
  return db
    .select()
    .from(equipmentDailyCheck)
    .where(eq(equipmentDailyCheck.organizationId, organizationId))
    .orderBy(desc(equipmentDailyCheck.createdAt))
    .limit(limit)
}

// امتثال اليوم: نسبة المعدات التي جرى فحصها اليوم، والمعدات غير المفحوصة في الوردية الحالية.
export async function getComplianceToday(): Promise<{
  totalActive: number
  checkedToday: number
  outOfService: number
  currentShift: "1" | "2" | "3"
  uninspectedThisShift: { id: number; fleetNo: string; plateNumber: string; equipmentType: string }[]
}> {
  const { organizationId } = await requireScope()
  const checkDate = todayMuscat()
  const currentShift = shiftForNow()

  const active = await db
    .select({
      id: equipment.id,
      fleetNo: equipment.fleetNo,
      plateNumber: equipment.plateNumber,
      equipmentType: equipment.equipmentType,
      operationalStatus: equipment.operationalStatus,
    })
    .from(equipment)
    .where(and(eq(equipment.organizationId, organizationId), eq(equipment.active, true)))

  const todays = await db
    .select({ equipmentId: equipmentDailyCheck.equipmentId, shift: equipmentDailyCheck.shift })
    .from(equipmentDailyCheck)
    .where(and(eq(equipmentDailyCheck.organizationId, organizationId), eq(equipmentDailyCheck.checkDate, checkDate)))

  const checkedTodaySet = new Set(todays.map((t) => t.equipmentId))
  const checkedThisShiftSet = new Set(todays.filter((t) => t.shift === currentShift).map((t) => t.equipmentId))

  const outOfService = active.filter((a) => a.operationalStatus === "out_of_service").length
  const uninspectedThisShift = active
    .filter((a) => a.operationalStatus !== "out_of_service" && !checkedThisShiftSet.has(a.id))
    .map((a) => ({ id: a.id, fleetNo: a.fleetNo ?? "", plateNumber: a.plateNumber ?? "", equipmentType: a.equipmentType ?? "" }))

  return {
    totalActive: active.length,
    checkedToday: active.filter((a) => checkedTodaySet.has(a.id)).length,
    outOfService,
    currentShift,
    uninspectedThisShift,
  }
}

// سجل الفحوصات الأخيرة مُثرى ببيانات المعدة (للوحة متابعة المشرف).
export type RecentCheckRow = {
  id: number
  code: string
  equipmentId: number
  fleetNo: string
  plateNumber: string
  equipmentType: string
  operatorName: string
  shift: string
  checkDate: string
  result: string
  permitStatus: string
  entryMethod: string
  createdAt: Date
}

export async function getRecentChecksDetailed(limit = 200): Promise<RecentCheckRow[]> {
  const { organizationId } = await requireScope()
  const rows = await db
    .select({
      id: equipmentDailyCheck.id,
      code: equipmentDailyCheck.code,
      equipmentId: equipmentDailyCheck.equipmentId,
      fleetNo: equipment.fleetNo,
      plateNumber: equipment.plateNumber,
      equipmentType: equipment.equipmentType,
      operatorName: equipmentDailyCheck.operatorName,
      shift: equipmentDailyCheck.shift,
      checkDate: equipmentDailyCheck.checkDate,
      result: equipmentDailyCheck.result,
      permitStatus: equipmentDailyCheck.permitStatus,
      entryMethod: equipmentDailyCheck.entryMethod,
      createdAt: equipmentDailyCheck.createdAt,
    })
    .from(equipmentDailyCheck)
    .leftJoin(equipment, eq(equipmentDailyCheck.equipmentId, equipment.id))
    .where(eq(equipmentDailyCheck.organizationId, organizationId))
    .orderBy(desc(equipmentDailyCheck.createdAt))
    .limit(limit)
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    equipmentId: r.equipmentId,
    fleetNo: r.fleetNo ?? "",
    plateNumber: r.plateNumber ?? "",
    equipmentType: r.equipmentType ?? "",
    operatorName: r.operatorName,
    shift: r.shift,
    checkDate: String(r.checkDate),
    result: r.result,
    permitStatus: r.permitStatus,
    entryMethod: r.entryMethod,
    createdAt: r.createdAt,
  }))
}

// بيانات ملصقات QR لكل المعدات الفعّالة (للطباعة واللصق على المعدات).
export type QrLabelRow = {
  id: number
  fleetNo: string
  plateNumber: string
  equipmentType: string
  powerType: string
  qrToken: string
}

export async function getQrLabels(): Promise<QrLabelRow[]> {
  const { organizationId } = await requireScope()
  const rows = await db
    .select({
      id: equipment.id,
      fleetNo: equipment.fleetNo,
      plateNumber: equipment.plateNumber,
      equipmentType: equipment.equipmentType,
      powerType: equipment.powerType,
      qrToken: equipment.qrToken,
    })
    .from(equipment)
    .where(and(eq(equipment.organizationId, organizationId), eq(equipment.active, true)))
    .orderBy(asc(equipment.fleetNo))
  return rows.map((r) => ({
    id: r.id,
    fleetNo: r.fleetNo ?? "",
    plateNumber: r.plateNumber ?? "",
    equipmentType: r.equipmentType ?? "",
    powerType: r.powerType ?? "diesel",
    qrToken: r.qrToken ?? "",
  }))
}

// العيوب المتكررة خلال آخر 30 يوماً (تجميع حسب بند الفحص).
export async function getRecurringDefects(days = 30): Promise<{ itemCode: string; labelAr: string; count: number; critical: number }[]> {
  const { organizationId } = await requireScope()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const rows = await db
    .select({
      itemCode: equipmentDailyCheckItem.itemCode,
      labelAr: equipmentDailyCheckItem.labelAr,
      isSafetyCritical: equipmentDailyCheckItem.isSafetyCritical,
      checkId: equipmentDailyCheckItem.checkId,
      createdAt: equipmentDailyCheck.createdAt,
    })
    .from(equipmentDailyCheckItem)
    .innerJoin(equipmentDailyCheck, eq(equipmentDailyCheckItem.checkId, equipmentDailyCheck.id))
    .where(
      and(
        eq(equipmentDailyCheckItem.organizationId, organizationId),
        eq(equipmentDailyCheckItem.status, "defect"),
        gte(equipmentDailyCheck.createdAt, since),
      ),
    )

  const map = new Map<string, { itemCode: string; labelAr: string; count: number; critical: number }>()
  for (const r of rows) {
    const cur = map.get(r.itemCode) ?? { itemCode: r.itemCode, labelAr: r.labelAr, count: 0, critical: 0 }
    cur.count++
    if (r.isSafetyCritical) cur.critical++
    map.set(r.itemCode, cur)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}
