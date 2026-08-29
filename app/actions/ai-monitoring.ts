"use server"

import { db } from "@/lib/db"
import { aiDetection, activeCameraStream, aiMonitoringNotification, user, equipment } from "@/lib/db/schema"
import { and, desc, eq, gte, isNull, inArray, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireUser, requireHseReviewerScope, assertWritable } from "@/lib/session"
import type { DetectionStatus, FrameViolation } from "@/lib/ai-monitoring"
import { mergeFrameViolations } from "@/lib/ai-monitoring"
import { normalizePlate, normalizeCode } from "@/lib/ai-recognition"
import { sessionCameraId } from "@/lib/camera-session"

const VALID_STATUS: DetectionStatus[] = ["new", "acknowledged", "resolved", "false_positive"]

export type AiDetection = typeof aiDetection.$inferSelect

// شكل صف الاكتشاف كما يُرسَل للوحة: بلا حقل base64 الثقيل، مع علامة توفّر لقطة،
// وقائمة أنواع المخالفات المرصودة في نفس اللقطة (مُحلّلة من JSON إلى مصفوفة).
// (اللقطة نفسها تُجلب عند الطلب من مسار .../snapshot لتخفيف حمولة التحديث الدوري.)
export type AiDetectionListItem = Omit<AiDetection, "snapshotUrl" | "detectionTypes"> & {
  snapshotUrl: string
  hasSnapshot: boolean
  detectionTypes: string[]
}

// تحليل عمود detection_types (سلسلة JSON) إلى مصفوفة أنواع، مع تعويض السجلات
// القديمة التي لا تملك القيمة بالنوع الأساسي المفرد.
function parseDetectionTypes(raw: string, primary: string): string[] {
  try {
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    if (Array.isArray(arr) && arr.length > 0) return arr.map((t) => String(t))
  } catch {
    /* تجاهل JSON التالف ونعوّض بالنوع الأساسي */
  }
  return primary ? [primary] : []
}

// تحويل صف قاعدة البيانات إلى عنصر قائمة خفيف: نُفرّغ base64 الضخم ونضع علامة
// hasSnapshot فقط. هذا يقلّص حمولة التحديث كل 10 ثوانٍ من عدة ميغابايت إلى كيلوبايتات.
function toListItem(row: AiDetection): AiDetectionListItem {
  const { snapshotUrl, detectionTypes, ...rest } = row
  return {
    ...rest,
    snapshotUrl: "",
    hasSnapshot: Boolean(snapshotUrl && snapshotUrl.length > 0),
    detectionTypes: parseDetectionTypes(detectionTypes, rest.detectionType),
  }
}

// قائمة الاكتشافات مرتبة بالأحدث (بدون base64 الثقيل — انظر toListItem).
export async function getDetections(): Promise<AiDetectionListItem[]> {
  const { userId, organizationId, isManager } = await requireHseReviewerScope()
  const where = isManager
    ? eq(aiDetection.organizationId, organizationId)
    : and(eq(aiDetection.organizationId, organizationId), eq(aiDetection.userId, userId))
  const rows = await db.select().from(aiDetection).where(where).orderBy(desc(aiDetection.detectedAt))
  return rows.map(toListItem)
}

// لقطة إثبات اكتشاف واحد عند الطلب (base64 كامل). تحترم نطاق الرؤية نفسه داخل المؤسسة:
// المدير يرى كل اللقطات، وغيره يرى لقطات اكتشافات أجهزته فقط.
export async function getDetectionSnapshot(id: number): Promise<string> {
  const { userId, organizationId, isManager } = await requireHseReviewerScope()
  const where = isManager
    ? and(eq(aiDetection.organizationId, organizationId), eq(aiDetection.id, id))
    : and(eq(aiDetection.organizationId, organizationId), eq(aiDetection.id, id), eq(aiDetection.userId, userId))
  const rows = await db
    .select({ snapshotUrl: aiDetection.snapshotUrl })
    .from(aiDetection)
    .where(where)
    .limit(1)
  return rows[0]?.snapshotUrl ?? ""
}

export type ActiveCameraStream = typeof activeCameraStream.$inferSelect

// نافذة اعتبار الكاميرا "متصلة حالياً" (بالثواني): آخر إرسال خلال آخر دقيقتين.
const ACTIVE_WINDOW_SECONDS = 120

// تحديث (أو إنشاء) سجل الكاميرا المتصلة مع نبضة الاتصال (heartbeat).
// هوية الجلسة مشتقّة من (الحساب + اسم المفتش المُدخل)، فيحصل كل مفتش على سجله الخاص
// حتى لو تشارك عدّة مفتشين نفس الرابط/الحساب، ويُعاد استخدام السجل نفسه عند عودته.
// إذا مُرِّر lastFrameUrl (رابط Blob) يُحدَّث، وإلا يُحتفظ بالرابط الحالي كما هو
// حتى لا يمحو استدعاءُ التحليل رابطَ الإطار المرفوع إلى Blob.
export async function touchCameraStream(input: {
  inspectorName: string
  cameraLocation: string
  lastFrameUrl?: string
}): Promise<void> {
  await assertWritable()
  // البث/التسجيل متاح لأي مستخدم مسجّل دخول (الموظف المصوّر).
  const { id: userId, organizationId } = await requireUser()
  const inspectorName = (input.inspectorName || "كاميرا الهاتف").slice(0, 160)
  const cameraId = sessionCameraId(userId, inspectorName)
  const cameraLocation = (input.cameraLocation || "").slice(0, 200)
  const hasFrame = typeof input.lastFrameUrl === "string" && input.lastFrameUrl.length > 0
  const lastFrameUrl = hasFrame ? (input.lastFrameUrl as string) : ""

  const set: Partial<typeof activeCameraStream.$inferInsert> = {
    inspectorName,
    cameraLocation,
    lastSeenAt: new Date(),
  }
  if (hasFrame) set.lastFrameUrl = lastFrameUrl

  await db
    .insert(activeCameraStream)
    .values({ userId, organizationId, cameraId, inspectorName, cameraLocation, lastFrameUrl, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: [activeCameraStream.userId, activeCameraStream.cameraId],
      set,
    })
}

// الكاميرات المتصلة حالياً (آخر إرسال خلال نافذة الاعتبار)، الأحدث أولاً.
export async function getActiveCameraStreams(): Promise<ActiveCameraStream[]> {
  const { userId, organizationId, isManager } = await requireHseReviewerScope()
  const since = new Date(Date.now() - ACTIVE_WINDOW_SECONDS * 1000)
  const base = db
    .select()
    .from(activeCameraStream)
    .where(
      isManager
        ? and(eq(activeCameraStream.organizationId, organizationId), gte(activeCameraStream.lastSeenAt, since))
        : and(eq(activeCameraStream.organizationId, organizationId), eq(activeCameraStream.userId, userId), gte(activeCameraStream.lastSeenAt, since)),
    )
    .orderBy(desc(activeCameraStream.lastSeenAt))
  return base
}

export type CameraLiveStatus = {
  camera: {
    cameraId: string
    inspectorName: string
    cameraLocation: string
    lastFrameUrl: string
    lastSeenAt: string
  } | null
  latestDetection: {
    detectionType: string
    severity: string
    confidenceScore: number
    detectedAt: string
    notes: string
  } | null
}

// حالة كاميرا واحدة للعرض المباشر: آخر إطار من Blob + آخر نتيجة تحليل AI.
// تحترم نطاق الرؤية نفسه (المدير يرى الكل، وغيره يرى كاميرات أجهزته فقط).
export async function getCameraLiveStatus(cameraId: string): Promise<CameraLiveStatus> {
  const { userId, organizationId, isManager } = await requireHseReviewerScope()
  const id = (cameraId || "").slice(0, 120)

  const camWhere = isManager
    ? and(eq(activeCameraStream.organizationId, organizationId), eq(activeCameraStream.cameraId, id))
    : and(eq(activeCameraStream.organizationId, organizationId), eq(activeCameraStream.cameraId, id), eq(activeCameraStream.userId, userId))
  const camRows = await db
    .select()
    .from(activeCameraStream)
    .where(camWhere)
    .orderBy(desc(activeCameraStream.lastSeenAt))
    .limit(1)
  const cam = camRows[0]

  const detWhere = isManager
    ? and(eq(aiDetection.organizationId, organizationId), eq(aiDetection.cameraId, id))
    : and(eq(aiDetection.organizationId, organizationId), eq(aiDetection.cameraId, id), eq(aiDetection.userId, userId))
  const detRows = await db
    .select()
    .from(aiDetection)
    .where(detWhere)
    .orderBy(desc(aiDetection.detectedAt))
    .limit(1)
  const det = detRows[0]

  return {
    camera: cam
      ? {
          cameraId: cam.cameraId,
          inspectorName: cam.inspectorName,
          cameraLocation: cam.cameraLocation,
          lastFrameUrl: cam.lastFrameUrl,
          lastSeenAt: (cam.lastSeenAt as unknown as Date)?.toISOString?.() ?? String(cam.lastSeenAt),
        }
      : null,
    latestDetection: det
      ? {
          detectionType: det.detectionType,
          severity: det.severity,
          confidenceScore: det.confidenceScore,
          detectedAt:
            (det.detectedAt as unknown as Date)?.toISOString?.() ?? String(det.detectedAt),
          notes: det.notes ?? "",
        }
      : null,
  }
}

// توليد معرّف الاكتشاف بالصيغة AID-YYYY-### تسلسلياً حسب السنة داخل المؤسسة.
async function nextDetectionId(organizationId: string): Promise<string> {
  const year = new Date().getFullYear()
  const rows = await db
    .select({ detectionId: aiDetection.detectionId })
    .from(aiDetection)
    .where(eq(aiDetection.organizationId, organizationId))
  const prefix = `AID-${year}-`
  const maxSeq = rows
    .map((r) => r.detectionId ?? "")
    .filter((n) => n.startsWith(prefix))
    .reduce((max, n) => {
      const seq = Number.parseInt(n.slice(prefix.length), 10)
      return Number.isFinite(seq) && seq > max ? seq : max
    }, 0)
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`
}

// نافذة منع التكرار: طالما استمر نفس السلوك المخالف لنفس الشخص/المركبة في نفس
// الموقع خلال هذه المدة، يُحدَّث السجل الموجود بدل إنشاء سجل جديد.
const DEDUP_WINDOW_MINUTES = 15

const SEVERITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }

// اختيار المخالفة الأساسية الأشد خطورة بين القائمة والجديدة (لتصنيف السجل المدموج).
function pickPrimary(
  a: { type: string; severity: string },
  b: { type: string; severity: string },
): { type: string; severity: string } {
  return (SEVERITY_RANK[b.severity] ?? 0) > (SEVERITY_RANK[a.severity] ?? 0) ? b : a
}

// دمج ملاحظات المخالفات (القديمة + الجديدة) في نص واحد يذكر كل المخالفات مرة واحدة،
// مع إزالة التكرار حسب اسم المخالفة (الجزء قبل ":") حفاظاً على الوصف الأول لكل نوع.
function mergeNotes(existing: string, incoming: string): string {
  const parts = [...(existing || "").split(" • "), ...(incoming || "").split(" • ")]
    .map((s) => s.trim())
    .filter(Boolean)
  const seen = new Map<string, string>()
  for (const p of parts) {
    const label = (p.split(":")[0] || p).trim()
    if (!seen.has(label)) seen.set(label, p)
  }
  return [...seen.values()].join(" • ").slice(0, 1000)
}

// حفظ كل مخالفات الإطار الواحد في سجل واحد فقط. يُستدعى مرة واحدة لكل لقطة من
// مسار /api/ai-monitoring/analyze: إن رُصدت عدة مخالفات في نفس الإطار (مثل
// عامل بلا خوذة وبلا سترة عاكسة) تُدمج جميعها في بند واحد بنفس اللقطة بدل تكرار
// صفوف بنفس الصورة. يُرجع السجل المُنشأ/المُحدَّث أو null إن لم تُرصد أي مخالفة.
//
// منع التكرار عبر الإطارات المتتالية: قبل الإنشاء نبحث عن سجل «مفتوح» (غير محلول/
// غير مرفوض) لنفس نوع المخالفة الأساسي ولنفس الهوية (subjectKey) في نفس الموقع
// رُصد آخر مرة خلال آخر DEDUP_WINDOW_MINIUTES دقيقة. إن وُجد نُحدّث عدّاد الرصد
// (detectionCount) وآخر وقت رصد وأحدث لقطة بدل إنشاء صف مكرر. يُنشأ سجل جديد فقط
// عند اختلاف النوع أو الهوية أو الموقع، أو انقطاع الرصد أطول من النافذة الزمنية.
export async function saveFrameDetection(input: {
  inspectorName: string
  cameraLocation: string
  snapshotUrl?: string
  detections: FrameViolation[]
  subjectKey?: string
  subjectType?: string
}): Promise<AiDetection | null> {
  await assertWritable()
  const merged = mergeFrameViolations(input.detections)
  if (!merged) return null

  // يُستدعى نيابةً عن الموظف المصوّر (أي مستخدم مسجّل دخول).
  const { id: userId, organizationId } = await requireUser()
  // نفس معرّف جلسة الكاميرا المستخدم في البث المباشر (مشتقّ من اسم المفتش).
  const cameraId = sessionCameraId(userId, input.inspectorName || "")
  const cameraLocation = input.cameraLocation?.slice(0, 200) || ""
  const subjectKey = (input.subjectKey || "").slice(0, 120)
  const subjectType = (input.subjectType || "").slice(0, 20)
  const now = new Date()
  const windowStart = new Date(now.getTime() - DEDUP_WINDOW_MINUTES * 60_000)

  // البحث عن سجل مفتوح مطابق ضمن النافذة الزمنية لدمج الرصد المتكرر فيه.
  // عند وجود هوية معروفة (subjectKey غير فارغ) نُطابق بالشخص/المركبة فقط — لا بنوع
  // المخالفة — حتى تُجمَّع كل مخالفات نفس الشخص في سجل واحد بصورة واحدة. أما عند غياب
  // الهوية (اكتشاف مجهول) فنُبقي المطابقة على نفس النوع حتى لا تُدمج اكتشافات غير مرتبطة.
  const matchConditions = [
    eq(aiDetection.organizationId, organizationId),
    eq(aiDetection.cameraLocation, cameraLocation),
    eq(aiDetection.subjectKey, subjectKey),
    inArray(aiDetection.status, ["new", "acknowledged"]),
    gte(aiDetection.lastDetectedAt, windowStart),
  ]
  if (!subjectKey) {
    matchConditions.push(eq(aiDetection.detectionType, merged.primaryType))
  }
  const [existing] = await db
    .select()
    .from(aiDetection)
    .where(and(...matchConditions))
    .orderBy(desc(aiDetection.lastDetectedAt))
    .limit(1)

  if (existing) {
    // تحديث السجل القائم: زيادة العدّاد، تحديث آخر وقت رصد وأحدث لقطة، وجمع كل أنواع
    // المخالفات وملاحظاتها في نفس السجل، مع رفع التصنيف للأشد خطورة.
    const mergedTypes = Array.from(
      new Set([...parseDetectionTypes(existing.detectionTypes, existing.detectionType), ...merged.types]),
    )
    const primary = pickPrimary(
      { type: existing.detectionType, severity: existing.severity },
      { type: merged.primaryType, severity: merged.primarySeverity },
    )
    const [updated] = await db
      .update(aiDetection)
      .set({
        detectionCount: existing.detectionCount + 1,
        lastDetectedAt: now,
        detectionType: primary.type,
        detectionTypes: JSON.stringify(mergedTypes),
        severity: primary.severity,
        confidenceScore: Math.max(existing.confidenceScore, merged.primaryConfidence),
        // نجمع كل المخ��لفات في نص ملاحظات واحد يذكرها جميعاً مرة واحدة.
        notes: mergeNotes(existing.notes || "", merged.notes),
        // نحدّث اللقطة لأحدث دليل بصري إن توفّرت لقطة جديدة.
        snapshotUrl: input.snapshotUrl || existing.snapshotUrl,
      })
      .where(eq(aiDetection.id, existing.id))
      .returning()
    revalidatePath("/ai-monitoring")
    return updated
  }

  const detectionId = await nextDetectionId(organizationId)
  const [row] = await db
    .insert(aiDetection)
    .values({
      userId,
      organizationId,
      detectionId,
      cameraId,
      inspectorName: input.inspectorName?.slice(0, 160) || "كاميرا الهاتف",
      cameraLocation,
      detectionType: merged.primaryType,
      detectionTypes: JSON.stringify(merged.types),
      severity: merged.primarySeverity,
      confidenceScore: merged.primaryConfidence,
      snapshotUrl: input.snapshotUrl || "",
      notes: merged.notes,
      status: "new",
      detectionCount: 1,
      lastDetectedAt: now,
      subjectKey,
      subjectType,
    })
    .returning()

  // إشعار المسؤولين والمفتشين عند الاكتشافات عالية الخطورة/الحرجة (سلوك مدموج من
  // فرع ai-smart-monitoring). لا يوقف فشلُ الإشعار حفظَ الاكتشاف. يُرسَل مرة واحدة
  // عند إنشاء السجل فقط — لا يتكرر مع كل رصد لاحق لنفس المخالفة المستمرة.
  if (merged.primarySeverity === "high" || merged.primarySeverity === "critical") {
    try {
      await createDetectionNotifications(row, merged.primarySeverity)
    } catch {
      /* تجاهل أخطاء الإشعار حتى لا يفشل حفظ الاكتشاف */
    }
  }

  revalidatePath("/ai-monitoring")
  return row
}

// إنشاء إشعارات لكل مستلم مؤهّل (مدير/مسؤول أو أقسام التفتيش/العمليات/غرفة التحكم)
// عن اكتشاف عالي الخطورة. مطابق لسلوك فرع ai-smart-monitoring مع مواءمة الأنواع.
async function createDetectionNotifications(
  detection: AiDetection,
  severity: string,
): Promise<void> {
  // المستقبِلون من نفس مؤسسة الاكتشاف فقط.
  const recipients = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.organizationId, detection.organizationId),
        eq(user.status, "approved"),
        or(
          inArray(user.role, ["admin", "manager"]),
          inArray(user.department, ["inspector", "operations", "control_room"]),
        ),
      ),
    )
  if (!recipients.length) return
  await db
    .insert(aiMonitoringNotification)
    .values(
      recipients.map((recipient) => ({
        userId: recipient.id,
        organizationId: detection.organizationId,
        detectionId: detection.id,
        title: severity === "critical" ? "تنبيه كاميرا حرج" : "تنبيه كاميرا عالي الخطورة",
        message: `${detection.cameraLocation || detection.inspectorName} — ${detection.detectionId}`,
      })),
    )
    .onConflictDoNothing()
}

// إشعارات المستخدم الحالي غير المقروءة (الأحدث أولاً) — يستهلكها مسار
// /api/ai-monitoring/notifications لعرض جرس الإشعارات.
export async function getUnreadAiNotifications() {
  const current = await requireUser()
  return db
    .select()
    .from(aiMonitoringNotification)
    .where(
      and(
        eq(aiMonitoringNotification.organizationId, current.organizationId),
        eq(aiMonitoringNotification.userId, current.id),
        isNull(aiMonitoringNotification.readAt),
      ),
    )
    .orderBy(desc(aiMonitoringNotification.createdAt))
}

// تعليم كل إشعارات المستخدم الحالي غير المقروءة كمقروءة.
export async function markAiNotificationsRead() {
  const current = await requireUser()
  await db
    .update(aiMonitoringNotification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(aiMonitoringNotification.organizationId, current.organizationId),
        eq(aiMonitoringNotification.userId, current.id),
        isNull(aiMonitoringNotification.readAt),
      ),
    )
}

// تحديث حالة اكتشاف (اطّلاع / معالجة / إنذار خاطئ).
export async function updateDetectionStatus(id: number, status: string, notes?: string) {
  await assertWritable()
  const { userId, organizationId, isManager } = await requireHseReviewerScope()
  if (!(VALID_STATUS as string[]).includes(status)) throw new Error("حالة غير صالحة")

  const rows = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const actor = rows[0]?.name || "مستخدم"

  const where = isManager
    ? and(eq(aiDetection.organizationId, organizationId), eq(aiDetection.id, id))
    : and(eq(aiDetection.organizationId, organizationId), eq(aiDetection.id, id), eq(aiDetection.userId, userId))

  const patch: Partial<typeof aiDetection.$inferInsert> = { status }
  if (typeof notes === "string") patch.notes = notes.slice(0, 1000)
  if (status === "acknowledged") patch.acknowledgedBy = actor
  if (status === "resolved") patch.resolvedBy = actor

  await db.update(aiDetection).set(patch).where(where)
  revalidatePath("/ai-monitoring")
}

export async function deleteDetection(id: number) {
  await assertWritable()
  const { userId, organizationId, isManager } = await requireHseReviewerScope()
  const where = isManager
    ? and(eq(aiDetection.organizationId, organizationId), eq(aiDetection.id, id))
    : and(eq(aiDetection.organizationId, organizationId), eq(aiDetection.id, id), eq(aiDetection.userId, userId))
  await db.delete(aiDetection).where(where)
  revalidatePath("/ai-monitoring")
}

/* ---------------- تتبع المركبات ---------------- */

// رصدة واحدة لمركبة: أين ومتى رُصدت وما نوع المخالفة وعدد مرات استمرارها.
export type VehicleSighting = {
  detectionId: number
  location: string
  at: string
  detectionType: string
  detectionTypes: string[]
  severity: string
  status: string
  count: number
}

// مركبة متتبَّعة: بياناتها من السجل (إن كانت مسجّلة) + خلاصة رصداتها من المراقبة الذكية.
export type TrackedVehicle = {
  key: string
  plate: string
  registered: boolean
  equipmentType: string
  ownerCompany: string
  driverName: string
  internalCode: string
  active: boolean
  totalSightings: number
  totalDetections: number
  openViolations: number
  lastSeenAt: string | null
  lastSeenLocation: string | null
  sightings: VehicleSighting[]
}

const OPEN_STATUSES = new Set(["new", "acknowledged"])

// تتبّع المركبات: يربط رصدات المراقبة الذكية (subjectType='vehicle') بسجل المعدات
// عبر اللوحة المطبّعة، فيعرض لكل مركبة آخر ظهور وموقعه وعدد الرصدات والمخالفات المفتوحة
// وسجل ظهورها. يشمل المركبات المسجّلة (حتى بلا رصدات) والمركبات المرصودة غير المسجّلة.
export async function getVehicleTracking(): Promise<TrackedVehicle[]> {
  const { userId, organizationId, isManager } = await requireHseReviewerScope()

  const detWhere = isManager
    ? and(eq(aiDetection.organizationId, organizationId), eq(aiDetection.subjectType, "vehicle"))
    : and(
        eq(aiDetection.organizationId, organizationId),
        eq(aiDetection.subjectType, "vehicle"),
        eq(aiDetection.userId, userId),
      )
  const detRows = await db
    .select()
    .from(aiDetection)
    .where(detWhere)
    .orderBy(desc(aiDetection.lastDetectedAt))

  const equipRows = await db
    .select()
    .from(equipment)
    .where(eq(equipment.organizationId, organizationId))

  // تجميع الرصدات حسب مفتاح الهوية (subjectKey).
  const groups = new Map<string, typeof detRows>()
  for (const r of detRows) {
    const key = r.subjectKey || "veh:?"
    const list = groups.get(key)
    if (list) list.push(r)
    else groups.set(key, [r])
  }

  const toSighting = (r: (typeof detRows)[number]): VehicleSighting => ({
    detectionId: r.id,
    location: r.cameraLocation || "",
    at: (r.lastDetectedAt as unknown as Date)?.toISOString?.() ?? String(r.lastDetectedAt),
    detectionType: r.detectionType,
    detectionTypes: parseDetectionTypes(r.detectionTypes, r.detectionType),
    severity: r.severity,
    status: r.status,
    count: r.detectionCount,
  })

  const buildSummary = (rows: (typeof detRows)) => {
    const sightings = rows.map(toSighting)
    const totalDetections = rows.reduce((s, r) => s + (r.detectionCount || 1), 0)
    const openViolations = rows.filter((r) => OPEN_STATUSES.has(r.status)).length
    const last = sightings[0] ?? null // مرتّبة تنازلياً بآخر رصد
    return {
      totalSightings: rows.length,
      totalDetections,
      openViolations,
      lastSeenAt: last?.at ?? null,
      lastSeenLocation: last?.location ?? null,
      sightings: sightings.slice(0, 25),
    }
  }

  const result: TrackedVehicle[] = []
  const usedKeys = new Set<string>()

  // المركبات المسجّلة أولاً (تُعرض حتى دون رصدات).
  for (const e of equipRows) {
    const vehKey = `veh:${normalizePlate(e.plateNumber)}`
    const tukKey = `tuk:${normalizeCode(e.plateNumber)}`
    const matched = [vehKey, tukKey].filter((k) => groups.has(k))
    const rows = matched.flatMap((k) => {
      usedKeys.add(k)
      return groups.get(k) as typeof detRows
    })
    rows.sort((a, b) => {
      const ta = (a.lastDetectedAt as unknown as Date)?.getTime?.() ?? 0
      const tb = (b.lastDetectedAt as unknown as Date)?.getTime?.() ?? 0
      return tb - ta
    })
    result.push({
      key: vehKey,
      plate: e.plateNumber,
      registered: true,
      equipmentType: e.equipmentType,
      ownerCompany: e.ownerCompany,
      driverName: e.driverName,
      internalCode: e.internalCode,
      active: e.active,
      ...buildSummary(rows),
    })
  }

  // المركبات المرصودة غير المسجّلة في السجل.
  for (const [key, rows] of groups) {
    if (usedKeys.has(key)) continue
    const plate = key.replace(/^(veh:|tuk:)/, "") || "?"
    result.push({
      key,
      plate,
      registered: false,
      equipmentType: "",
      ownerCompany: "",
      driverName: "",
      internalCode: "",
      active: true,
      ...buildSummary(rows),
    })
  }

  // ترتيب: الأحدث ظهوراً أولاً، ثم المسجّلة بلا رصدات في النهاية.
  result.sort((a, b) => {
    const ta = a.lastSeenAt ? Date.parse(a.lastSeenAt) : 0
    const tb = b.lastSeenAt ? Date.parse(b.lastSeenAt) : 0
    return tb - ta
  })

  return result
}
