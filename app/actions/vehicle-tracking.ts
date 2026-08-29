"use server"

import { db } from "@/lib/db"
import { vehicle, vehicleEntry, vehicleSighting, violation, aiDetection, gate } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireModuleScope, assertWritable } from "@/lib/session"
import { normalizePlate } from "@/lib/ai-recognition"
import {
  GATE_COUNT,
  type VehicleStatus,
  type GateActionResult,
  type EntrySightingDto,
  type EntryViolationDto,
  type VehicleEntryDto,
  type VehicleDetailDto,
  type TrackingOverview,
  type PresentVehicleDto,
  type FrameSource,
  type GateSettingDto,
} from "@/lib/vehicle-tracking-shared"

/* ============================================================
   موديول تتبع المركبات — منطق البوابات (7 بوابات)
   الحالات: outside (خارج) | inside (داخل) | blocked (محجوبة عن الخروج)
   ============================================================ */

// إيجاد/إنشاء السجل الرئيسي للمركبة بمطابقة اللوحة المطبّعة (حروف+أرقام موحّدة).
async function findOrCreateVehicle(organizationId: string, plateRaw: string, vehicleType?: string) {
  const plateKey = normalizePlate(plateRaw)
  const [existing] = await db
    .select()
    .from(vehicle)
    .where(and(eq(vehicle.organizationId, organizationId), eq(vehicle.plateKey, plateKey)))
    .limit(1)
  if (existing) return existing
  const [created] = await db
    .insert(vehicle)
    .values({
      organizationId,
      plateNumber: plateRaw.trim(),
      plateKey,
      vehicleType: vehicleType || "truck",
      currentStatus: "outside",
    })
    .returning()
  return created
}

// آخر دخول مفتوح لمركبة (أو null).
async function findOpenEntry(organizationId: string, vehicleId: number) {
  const [open] = await db
    .select()
    .from(vehicleEntry)
    .where(
      and(
        eq(vehicleEntry.organizationId, organizationId),
        eq(vehicleEntry.vehicleId, vehicleId),
        eq(vehicleEntry.status, "open"),
      ),
    )
    .orderBy(desc(vehicleEntry.entryTime))
    .limit(1)
  return open ?? null
}

/* ---------------- دخول مركبة من بوابة ---------------- */
export async function recordVehicleEntry(
  plateRaw: string,
  gateId: number,
  vehicleType?: string,
  entryMethod: "auto" | "manual" = "manual",
): Promise<GateActionResult> {
  await assertWritable()
    const { organizationId } = await requireModuleScope("ai_monitoring")
  const plate = (plateRaw || "").trim()
  if (!plate) return { ok: false, action: "error", message: "رقم اللوحة مطلوب", plate }

  const v = await findOrCreateVehicle(organizationId, plate, vehicleType)
  // إن كان لها دخول مفتوح بالفعل فهي داخل السوق — لا ننشئ دخولاً مكرراً.
  const open = await findOpenEntry(organizationId, v.id)
  if (open) {
    return {
      ok: false,
      action: "error",
      message: "المركبة داخل السوق بالفعل (دخول مفتوح قائم)",
      plate: v.plateNumber,
      status: v.currentStatus as VehicleStatus,
    }
  }

  await db.insert(vehicleEntry).values({
    organizationId,
    vehicleId: v.id,
    entryGateId: gateId,
    status: "open",
    entryMethod,
  })
  await db
    .update(vehicle)
    .set({ currentStatus: "inside", updatedAt: new Date() })
    .where(eq(vehicle.id, v.id))

  revalidatePath("/vehicle-tracking")
  return {
    ok: true,
    action: "entry",
    message: `تم تسجيل دخول المركبة من البوابة ${gateId}`,
    plate: v.plateNumber,
    status: "inside",
  }
}

/* ---------------- رصد مركبة بكاميرا داخلية ---------------- */
export async function recordVehicleSighting(
  plateRaw: string,
  cameraId: string,
  locationName: string,
  entryMethod: "auto" | "manual" = "manual",
): Promise<GateActionResult> {
  await assertWritable()
    const { organizationId } = await requireModuleScope("ai_monitoring")
  const plate = (plateRaw || "").trim()
  if (!plate) return { ok: false, action: "error", message: "رقم اللوحة مطلوب", plate }

  const v = await findOrCreateVehicle(organizationId, plate)
  const open = await findOpenEntry(organizationId, v.id)
  if (!open) {
    return {
      ok: false,
      action: "error",
      message: "لا يوجد دخول مفتوح لهذه المركبة — لا يمكن ربط المشاهدة",
      plate: v.plateNumber,
      status: v.currentStatus as VehicleStatus,
    }
  }
  await db.insert(vehicleSighting).values({
    organizationId,
    entryId: open.id,
    cameraId: cameraId || "",
    locationName: locationName || "",
    entryMethod,
  })
  revalidatePath("/vehicle-tracking")
  return {
    ok: true,
    action: "sighting",
    message: `تم تسجيل مشاهدة في ${locationName || cameraId}`,
    plate: v.plateNumber,
    status: v.currentStatus as VehicleStatus,
  }
}

/* ---------------- قراءة كاميرا تلقائية عند بوابة (الوضع التلقائي) ---------------- */
// يُستدعى من واجهة "الوضع التلقائي" بعد أن تقرأ الكاميرا لوحةً بدرجة ثقة كافية.
// المنطق: إن لم يكن للمركبة دخول مفتوح فهي قادمة من الخارج → نسجّل دخولاً تلقائياً؛
// وإن كان لها دخول مفتوح فهي داخل السوق → نسجّل مشاهدة تلقائية على مسارها. المصدر auto.
export async function autoGateRead(plateRaw: string, gateId: number): Promise<GateActionResult> {
  const plate = (plateRaw || "").trim()
  if (!plate) return { ok: false, action: "error", message: "لم تُقرأ لوحة صالحة", plate }
  await assertWritable()
    const { organizationId } = await requireModuleScope("ai_monitoring")
  const v = await findOrCreateVehicle(organizationId, plate)
  const open = await findOpenEntry(organizationId, v.id)
  if (open) {
    return recordVehicleSighting(plate, `بوابة-${gateId}`, `منطقة البوابة ${gateId}`, "auto")
  }
  return recordVehicleEntry(plate, gateId, undefined, "auto")
}

/* ---------------- إعدادات مصدر فريمات البوابات (تلقائي: جهاز/بث خارجي) ---------------- */

// إعدادات كل البوابات للمؤسسة، مع تعبئة الافتراضي (device) للبوابات غير المحفوظة بعد.
export async function getGateSettings(): Promise<GateSettingDto[]> {
    const { organizationId } = await requireModuleScope("ai_monitoring")
  const rows = await db.select().from(gate).where(eq(gate.organizationId, organizationId))
  const byNumber = new Map(rows.map((r) => [r.gateNumber, r]))
  const out: GateSettingDto[] = []
  for (let n = 1; n <= GATE_COUNT; n++) {
    const r = byNumber.get(n)
    out.push({
      gateNumber: n,
      frameSource: r?.frameSource === "external" ? "external" : "device",
      lastFrameAt: r?.lastFrameAt ? r.lastFrameAt.toISOString() : null,
      lastPlate: r?.lastPlate ?? null,
    })
  }
  return out
}

// تحديد مصدر الفريمات لبوابة معيّنة (upsert على مفتاح المؤسسة + رقم البوابة).
export async function setGateFrameSource(gateNumber: number, source: FrameSource): Promise<{ ok: boolean }> {
  await assertWritable()
    const { organizationId } = await requireModuleScope("ai_monitoring")
  const n = Math.trunc(Number(gateNumber))
  if (!Number.isFinite(n) || n < 1 || n > GATE_COUNT) return { ok: false }
  const frameSource: FrameSource = source === "external" ? "external" : "device"
  await db
    .insert(gate)
    .values({ organizationId, gateNumber: n, frameSource })
    .onConflictDoUpdate({
      target: [gate.organizationId, gate.gateNumber],
      set: { frameSource, updatedAt: new Date() },
    })
  revalidatePath("/ai-monitoring")
  return { ok: true }
}

// يُستدعى من POST /api/camera-feed عند وصول فريم خارجي — يسجّل آخر نشاط للبث لعرض حالته
// حيّاً في الواجهة. لا يمسّ منطق القراءة/التسجيل؛ يحدّث حقول العرض فقط.
export async function recordExternalFrame(gateNumber: number, plate: string): Promise<void> {
    const { organizationId } = await requireModuleScope("ai_monitoring")
  const n = Math.trunc(Number(gateNumber))
  if (!Number.isFinite(n) || n < 1 || n > GATE_COUNT) return
  const now = new Date()
  await db
    .insert(gate)
    .values({ organizationId, gateNumber: n, frameSource: "external", lastFrameAt: now, lastPlate: plate || null })
    .onConflictDoUpdate({
      target: [gate.organizationId, gate.gateNumber],
      set: { lastFrameAt: now, lastPlate: plate || null, updatedAt: now },
    })
}

/* ---------------- ربط مخالفة بالدخول المفتوح + حجب الخروج ---------------- */
// يُستدعى عند رصد مخالفة لمركبة داخل السوق: يربطها بالدخول المفتوح ويحوّل الحالة blocked.
export async function linkViolationToOpenEntry(
  organizationId: string,
  plateRaw: string,
  violationId: number,
): Promise<boolean> {
  const v = await findOrCreateVehicle(organizationId, plateRaw)
  const open = await findOpenEntry(organizationId, v.id)
  if (!open) return false
  await db
    .update(violation)
    .set({ entryId: open.id })
    .where(and(eq(violation.organizationId, organizationId), eq(violation.id, violationId)))
  await db
    .update(vehicle)
    .set({ currentStatus: "blocked", updatedAt: new Date() })
    .where(eq(vehicle.id, v.id))
  return true
}

// جمع المخالفات التي تحجب خروج الدخول الحالي من مصدر المراقبة الذكية (ai_detections):
// أي اكتشاف مركبة مفتوح (new/acknowledged) مرتبط بنفس subjectKey ضمن نافذة هذا الدخول.
async function getBlockingViolations(organizationId: string, entryId: number, plateKey: string) {
  // المخالفات الرسمية المرتبطة صراحةً بهذا الدخول.
  const linked = await db
    .select({ id: violation.id, type: violation.violationType, at: violation.createdAt })
    .from(violation)
    .where(and(eq(violation.organizationId, organizationId), eq(violation.entryId, entryId)))

  // اكتشافات المراقبة الذكية المفتوحة لنفس المركبة (المصدر المعتمد للحجب).
  const subjectKey = `veh:${plateKey}`
  const detections = await db
    .select({
      id: aiDetection.id,
      type: aiDetection.detectionType,
      severity: aiDetection.severity,
      status: aiDetection.status,
      at: aiDetection.lastDetectedAt,
    })
    .from(aiDetection)
    .where(and(eq(aiDetection.organizationId, organizationId), eq(aiDetection.subjectKey, subjectKey)))

  const open = detections.filter((d) => d.status === "new" || d.status === "acknowledged")
  const result: { id: number; type: string; severity: string; at: string }[] = []
  for (const d of open) {
    result.push({
      id: d.id,
      type: d.type,
      severity: d.severity,
      at: (d.at as unknown as Date)?.toISOString?.() ?? String(d.at),
    })
  }
  for (const lv of linked) {
    result.push({
      id: lv.id,
      type: lv.type || "مخالفة",
      severity: "high",
      at: (lv.at as unknown as Date)?.toISOString?.() ?? String(lv.at),
    })
  }
  return result
}

/* ---------------- محاولة خروج مركبة من بوابة ---------------- */
export async function attemptVehicleExit(plateRaw: string, gateId: number): Promise<GateActionResult> {
  await assertWritable()
    const { organizationId } = await requireModuleScope("ai_monitoring")
  const plate = (plateRaw || "").trim()
  if (!plate) return { ok: false, action: "error", message: "رقم اللوحة مطلوب", plate }

  const plateKey = normalizePlate(plate)
  const [v] = await db
    .select()
    .from(vehicle)
    .where(and(eq(vehicle.organizationId, organizationId), eq(vehicle.plateKey, plateKey)))
    .limit(1)
  if (!v) {
    return { ok: false, action: "error", message: "المركبة غير مسجّلة في النظام", plate }
  }
  const open = await findOpenEntry(organizationId, v.id)
  if (!open) {
    return {
      ok: false,
      action: "error",
      message: "لا يوجد دخول مفتوح — المركبة خارج السوق أصلاً",
      plate: v.plateNumber,
      status: v.currentStatus as VehicleStatus,
    }
  }

  const blocking = await getBlockingViolations(organizationId, open.id, plateKey)
  if (blocking.length > 0) {
    // نضمن أن الحالة تعكس الحجب.
    if (v.currentStatus !== "blocked") {
      await db.update(vehicle).set({ currentStatus: "blocked", updatedAt: new Date() }).where(eq(vehicle.id, v.id))
    }
    return {
      ok: false,
      action: "blocked",
      message: `مرفوض: يوجد ${blocking.length} مخالفة مفتوحة مرتبطة بهذا الدخول. لا يمكن فتح البوابة.`,
      plate: v.plateNumber,
      status: "blocked",
      blockingViolations: blocking,
    }
  }

  // لا مخالفات — نسمح بالخروج ونغلق الدخول.
  await db
    .update(vehicleEntry)
    .set({ status: "closed", exitTime: new Date(), exitGateId: gateId })
    .where(eq(vehicleEntry.id, open.id))
  await db
    .update(vehicle)
    .set({ currentStatus: "outside", updatedAt: new Date() })
    .where(eq(vehicle.id, v.id))

  revalidatePath("/vehicle-tracking")
  return {
    ok: true,
    action: "exit",
    message: `تم فتح البوابة ${gateId} وتسجيل خروج المركبة`,
    plate: v.plateNumber,
    status: "outside",
  }
}

/* ---------------- استعلامات العرض ---------------- */

// البحث عن مركبة برقم لوحتها وإرجاع سجلها الكامل: كل الدخولات + مشاهدات ومخالفات كل دخول.
export async function searchVehicle(plateRaw: string): Promise<VehicleDetailDto | null> {
    const { organizationId } = await requireModuleScope("ai_monitoring")
  const plateKey = normalizePlate(plateRaw)
  if (!plateKey) return null
  const [v] = await db
    .select()
    .from(vehicle)
    .where(and(eq(vehicle.organizationId, organizationId), eq(vehicle.plateKey, plateKey)))
    .limit(1)
  if (!v) return null

  const entries = await db
    .select()
    .from(vehicleEntry)
    .where(and(eq(vehicleEntry.organizationId, organizationId), eq(vehicleEntry.vehicleId, v.id)))
    .orderBy(desc(vehicleEntry.entryTime))

  const iso = (d: unknown) => (d as Date)?.toISOString?.() ?? (d ? String(d) : "")
  const subjectKey = `veh:${plateKey}`

  const entryDtos: VehicleEntryDto[] = []
  for (const e of entries) {
    const sightings = await db
      .select()
      .from(vehicleSighting)
      .where(eq(vehicleSighting.entryId, e.id))
      .orderBy(vehicleSighting.timestamp)
    const linkedViolations = await db
      .select({ id: violation.id, type: violation.violationType, at: violation.createdAt })
      .from(violation)
      .where(and(eq(violation.organizationId, organizationId), eq(violation.entryId, e.id)))

    const violDtos: EntryViolationDto[] = linkedViolations.map((lv) => ({
      id: lv.id,
      type: lv.type || "مخالفة",
      severity: "high",
      at: iso(lv.at),
      source: "violation",
    }))
    // للدخول المفتوح فقط: نضمّ اكتشافات المراقبة الذكية المفتوحة (مصدر الحجب).
    if (e.status === "open") {
      const dets = await db
        .select({
          id: aiDetection.id,
          type: aiDetection.detectionType,
          severity: aiDetection.severity,
          status: aiDetection.status,
          at: aiDetection.lastDetectedAt,
        })
        .from(aiDetection)
        .where(and(eq(aiDetection.organizationId, organizationId), eq(aiDetection.subjectKey, subjectKey)))
      for (const d of dets) {
        if (d.status === "new" || d.status === "acknowledged") {
          violDtos.push({ id: d.id, type: d.type, severity: d.severity, at: iso(d.at), source: "ai" })
        }
      }
    }

    entryDtos.push({
      id: e.id,
      entryGateId: e.entryGateId,
      entryTime: iso(e.entryTime),
      exitTime: e.exitTime ? iso(e.exitTime) : null,
      exitGateId: e.exitGateId ?? null,
      status: e.status,
      method: (e.entryMethod === "auto" ? "auto" : "manual"),
      sightings: sightings.map((s) => ({
        id: s.id,
        cameraId: s.cameraId,
        location: s.locationName,
        at: iso(s.timestamp),
        method: (s.entryMethod === "auto" ? "auto" : "manual"),
      })),
      violations: violDtos,
    })
  }

  return {
    id: v.id,
    plateNumber: v.plateNumber,
    vehicleType: v.vehicleType,
    currentStatus: v.currentStatus as VehicleStatus,
    entries: entryDtos,
  }
}

// خلاصة لبطاقات الحالة أعلى الصفحة.
export async function getTrackingOverview(): Promise<TrackingOverview> {
    const { organizationId } = await requireModuleScope("ai_monitoring")
  const rows = await db.select().from(vehicle).where(eq(vehicle.organizationId, organizationId))
  return {
    total: rows.length,
    inside: rows.filter((r) => r.currentStatus === "inside").length,
    outside: rows.filter((r) => r.currentStatus === "outside").length,
    blocked: rows.filter((r) => r.currentStatus === "blocked").length,
  }
}

// ---------------- الربط التلقائي من المراقبة الذكية ----------------
// يُستدعى من مسار التعرّف (/api/ai-monitoring/recognize) عند قراءة لوحة مركبة داخل
// السوق. المؤسسة تُمرَّر مباشرةً (المسار موثّق مسبقاً). المنطق: إن لم يوجد دخول مفتوح
// للمركبة نفتح واحداً تلقائياً (تُعتبر داخل السوق)، ثم نسجّل مشاهدة مربوطة بالدخول
// الحالي، وإذا رافق القراءةَ رصدُ مخالفة نحوّل حالة المر��بة إلى blocked. لا يرمي أخطاء
// حتى لا يُفشل استجابة التعرّف.
export async function autoTrackVehicleDetection(input: {
  organizationId: string
  plate: string
  location: string
  cameraId?: string
  hasViolation: boolean
}): Promise<void> {
  try {
    const { organizationId } = input
    const plate = (input.plate || "").trim()
    if (!organizationId || !plate) return
    const v = await findOrCreateVehicle(organizationId, plate)
    let open = await findOpenEntry(organizationId, v.id)
    if (!open) {
      const [created] = await db
        .insert(vehicleEntry)
        .values({ organizationId, vehicleId: v.id, entryGateId: 0, status: "open", entryMethod: "auto" })
        .returning()
      open = created
      await db
        .update(vehicle)
        .set({ currentStatus: "inside", updatedAt: new Date() })
        .where(eq(vehicle.id, v.id))
    }
    await db.insert(vehicleSighting).values({
      organizationId,
      entryId: open.id,
      cameraId: input.cameraId || "",
      locationName: input.location || "",
      entryMethod: "auto",
    })
    if (input.hasViolation) {
      await db
        .update(vehicle)
        .set({ currentStatus: "blocked", updatedAt: new Date() })
        .where(eq(vehicle.id, v.id))
    }
    revalidatePath("/vehicle-tracking")
  } catch (err) {
    console.log("[v0] autoTrackVehicleDetection error:", (err as Error).message)
  }
}

export async function getVehiclesInside(): Promise<PresentVehicleDto[]> {
    const { organizationId } = await requireModuleScope("ai_monitoring")
  const rows = await db
    .select({
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      vehicleType: vehicle.vehicleType,
      status: vehicle.currentStatus,
      entryGateId: vehicleEntry.entryGateId,
      entryTime: vehicleEntry.entryTime,
    })
    .from(vehicleEntry)
    .innerJoin(vehicle, eq(vehicle.id, vehicleEntry.vehicleId))
    .where(and(eq(vehicleEntry.organizationId, organizationId), eq(vehicleEntry.status, "open")))
    .orderBy(desc(vehicleEntry.entryTime))
  return rows.map((r) => ({
    id: r.id,
    plateNumber: r.plateNumber,
    vehicleType: r.vehicleType,
    status: r.status as VehicleStatus,
    entryGateId: r.entryGateId,
    entryTime: (r.entryTime as unknown as Date)?.toISOString?.() ?? String(r.entryTime),
  }))
}
