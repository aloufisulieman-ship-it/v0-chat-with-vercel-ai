"use server"

import { db } from "@/lib/db"
import { aiDetection, activeCameraStream, aiMonitoringNotification, user } from "@/lib/db/schema"
import { and, desc, eq, gte, isNull, inArray, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireUser, requireHseReviewerId } from "@/lib/session"
import type { DetectionType, DetectionStatus } from "@/lib/ai-monitoring"
import { severityByType, detectionTypeLabels } from "@/lib/ai-monitoring"
import { sessionCameraId } from "@/lib/camera-session"

const VALID_TYPES: DetectionType[] = [
  "no_ppe",
  "traffic_congestion",
  "unsafe_stacking",
  "overspeed",
  "restricted_area",
  "pedestrian_near_forklift",
]
const VALID_STATUS: DetectionStatus[] = ["new", "acknowledged", "resolved", "false_positive"]
const VALID_SEVERITY = ["low", "medium", "high", "critical"] as const

// المراجع (admin/manager) يرى كل الاكتشافات، وغيره يرى ما سجّلته أجهزته فقط.
async function isManager(userId: string) {
  const rows = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const u = rows[0]
  return u?.role === "admin" || u?.role === "manager"
}

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
  const userId = await requireHseReviewerId()
  const rows = (await isManager(userId))
    ? await db.select().from(aiDetection).orderBy(desc(aiDetection.detectedAt))
    : await db
        .select()
        .from(aiDetection)
        .where(eq(aiDetection.userId, userId))
        .orderBy(desc(aiDetection.detectedAt))
  return rows.map(toListItem)
}

// لقطة إثبات اكتشاف واحد عند الطلب (base64 كامل). تحترم نطاق الرؤية نفسه:
// المدير يرى كل اللقطات، وغيره يرى لقطات اكتشافات أجهزته فقط.
export async function getDetectionSnapshot(id: number): Promise<string> {
  const userId = await requireHseReviewerId()
  const manager = await isManager(userId)
  const where = manager
    ? eq(aiDetection.id, id)
    : and(eq(aiDetection.id, id), eq(aiDetection.userId, userId))
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
  // البث/التسجيل متاح لأي مستخدم مسجّل دخول (الموظف المصوّر).
  const userId = (await requireUser()).id
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
    .values({ userId, cameraId, inspectorName, cameraLocation, lastFrameUrl, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: [activeCameraStream.userId, activeCameraStream.cameraId],
      set,
    })
}

// الكاميرات المتصلة حالياً (آخر إرسال خلال نافذة الاعتبار)، الأحدث أولاً.
export async function getActiveCameraStreams(): Promise<ActiveCameraStream[]> {
  const userId = await requireHseReviewerId()
  const since = new Date(Date.now() - ACTIVE_WINDOW_SECONDS * 1000)
  const base = db
    .select()
    .from(activeCameraStream)
    .where(
      (await isManager(userId))
        ? gte(activeCameraStream.lastSeenAt, since)
        : and(eq(activeCameraStream.userId, userId), gte(activeCameraStream.lastSeenAt, since)),
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
  const userId = await requireHseReviewerId()
  const manager = await isManager(userId)
  const id = (cameraId || "").slice(0, 120)

  const camWhere = manager
    ? eq(activeCameraStream.cameraId, id)
    : and(eq(activeCameraStream.cameraId, id), eq(activeCameraStream.userId, userId))
  const camRows = await db
    .select()
    .from(activeCameraStream)
    .where(camWhere)
    .orderBy(desc(activeCameraStream.lastSeenAt))
    .limit(1)
  const cam = camRows[0]

  const detWhere = manager
    ? eq(aiDetection.cameraId, id)
    : and(eq(aiDetection.cameraId, id), eq(aiDetection.userId, userId))
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

// توليد معرّف الاكتشاف بالصيغة AID-YYYY-### تسلسلياً حسب السنة.
async function nextDetectionId(): Promise<string> {
  const year = new Date().getFullYear()
  const rows = await db.select({ detectionId: aiDetection.detectionId }).from(aiDetection)
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

// ترتيب الخطورة لاختيار المخالفة الأساسية عند اجتماع عدة مخالفات في لقطة واحدة.
const SEVERITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }

// مخالفة واحدة مرصودة داخل إطار (قبل التطبيع).
type FrameViolation = {
  type: string
  severity?: string
  confidence: number
  description?: string
}

// حفظ كل مخالفات الإطار الواحد في سجل واحد فقط. يُستدعى مرة واحدة لكل لقطة من
// مسار /api/ai-monitoring/analyze: إن رُصدت عدة مخالفات في نفس الإطار (مثل
// عامل بلا خوذة وبلا سترة عاكسة) تُدمج جميعها في بند واحد بنفس اللقطة بدل تكرار
// صفوف بنفس الصورة. يُرجع السجل المُنشأ أو null إن لم تُرصد أي مخالفة.
export async function saveFrameDetection(input: {
  inspectorName: string
  cameraLocation: string
  snapshotUrl?: string
  detections: FrameViolation[]
}): Promise<AiDetection | null> {
  if (!input.detections || input.detections.length === 0) return null

  // يُستدعى نيابةً عن الموظف المصوّر (أي مستخدم مسجّل دخول).
  const userId = (await requireUser()).id
  // نفس معرّف جلسة الكاميرا المستخدم في البث المباشر (مشتقّ من اسم المفتش).
  const cameraId = sessionCameraId(userId, input.inspectorName || "")

  // تطبيع كل مخالفة: نوع صالح + خطورة صالحة + ثقة ضمن 0-100.
  const normalized = input.detections.map((d) => {
    const type = (VALID_TYPES as string[]).includes(d.type)
      ? (d.type as DetectionType)
      : "no_ppe"
    const severity =
      d.severity && (VALID_SEVERITY as readonly string[]).includes(d.severity)
        ? d.severity
        : severityByType[type]
    const confidence = Math.max(0, Math.min(100, Math.round(d.confidence || 0)))
    return { type, severity, confidence, description: (d.description || "").trim() }
  })

  // إزالة التكرار حسب النوع داخل نفس الإطار (نُبقي الأعلى ثقة لكل نوع).
  const byType = new Map<string, (typeof normalized)[number]>()
  for (const d of normalized) {
    const existing = byType.get(d.type)
    if (!existing || d.confidence > existing.confidence) byType.set(d.type, d)
  }
  const unique = [...byType.values()]

  // المخالفة الأساسية = الأشد خطورة، ثم الأعلى ثقة (تُستخدم لـ detectionType/severity).
  const primary = unique.reduce((best, d) => {
    const dr = SEVERITY_RANK[d.severity] ?? 0
    const br = SEVERITY_RANK[best.severity] ?? 0
    if (dr > br || (dr === br && d.confidence > best.confidence)) return d
    return best
  })

  const types = unique.map((d) => d.type)
  // ملاحظات مجمّعة: «التسمية: الوصف» لكل نوع، مفصولة بنقطة.
  const notes = unique
    .map((d) => {
      const label = detectionTypeLabels[d.type] ?? d.type
      return d.description ? `${label}: ${d.description}` : label
    })
    .join(" • ")
    .slice(0, 1000)

  const detectionId = await nextDetectionId()
  const [row] = await db
    .insert(aiDetection)
    .values({
      userId,
      detectionId,
      cameraId,
      inspectorName: input.inspectorName?.slice(0, 160) || "كاميرا الهاتف",
      cameraLocation: input.cameraLocation?.slice(0, 200) || "",
      detectionType: primary.type,
      detectionTypes: JSON.stringify(types),
      severity: primary.severity,
      confidenceScore: primary.confidence,
      snapshotUrl: input.snapshotUrl || "",
      notes,
      status: "new",
    })
    .returning()

  // إشعار المسؤولين والمفتشين عند الاكتشافات عالية الخطورة/الحرجة (سلوك مدموج من
  // فرع ai-smart-monitoring). لا يوقف فشلُ الإشعار حفظَ الاكتشاف.
  if (primary.severity === "high" || primary.severity === "critical") {
    try {
      await createDetectionNotifications(row, primary.severity)
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
  const recipients = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
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
      and(eq(aiMonitoringNotification.userId, current.id), isNull(aiMonitoringNotification.readAt)),
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
      and(eq(aiMonitoringNotification.userId, current.id), isNull(aiMonitoringNotification.readAt)),
    )
}

// تحديث حالة اكتشاف (اطّلاع / معالجة / إنذار خاطئ).
export async function updateDetectionStatus(id: number, status: string, notes?: string) {
  const userId = await requireHseReviewerId()
  if (!(VALID_STATUS as string[]).includes(status)) throw new Error("حالة غير صالحة")

  const rows = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const actor = rows[0]?.name || "مستخدم"

  const manager = await isManager(userId)
  const where = manager ? eq(aiDetection.id, id) : and(eq(aiDetection.id, id), eq(aiDetection.userId, userId))

  const patch: Partial<typeof aiDetection.$inferInsert> = { status }
  if (typeof notes === "string") patch.notes = notes.slice(0, 1000)
  if (status === "acknowledged") patch.acknowledgedBy = actor
  if (status === "resolved") patch.resolvedBy = actor

  await db.update(aiDetection).set(patch).where(where)
  revalidatePath("/ai-monitoring")
}

export async function deleteDetection(id: number) {
  const userId = await requireHseReviewerId()
  const manager = await isManager(userId)
  const where = manager ? eq(aiDetection.id, id) : and(eq(aiDetection.id, id), eq(aiDetection.userId, userId))
  await db.delete(aiDetection).where(where)
  revalidatePath("/ai-monitoring")
}
