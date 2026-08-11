"use server"

import { db } from "@/lib/db"
import { aiDetection, activeCameraStream, user } from "@/lib/db/schema"
import { and, desc, eq, gte } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireModuleUserId } from "@/lib/session"
import type { DetectionType, DetectionStatus } from "@/lib/ai-monitoring"
import { severityByType } from "@/lib/ai-monitoring"

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

// المدير/الأدمن/مفتش السلامة يرى كل الاكتشافات، وغيرهم يرى ما سجّلته أجهزته فقط.
async function isManager(userId: string) {
  const rows = await db
    .select({ role: user.role, department: user.department })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const u = rows[0]
  return u?.role === "admin" || u?.department === "المدير العام" || u?.department === "مفتش السلامة"
}

export type AiDetection = typeof aiDetection.$inferSelect

// قائمة الاكتشافات مرتبة بالأحدث.
export async function getDetections(): Promise<AiDetection[]> {
  const userId = await requireModuleUserId("ai_monitoring")
  if (await isManager(userId)) {
    return db.select().from(aiDetection).orderBy(desc(aiDetection.detectedAt))
  }
  return db
    .select()
    .from(aiDetection)
    .where(eq(aiDetection.userId, userId))
    .orderBy(desc(aiDetection.detectedAt))
}

export type ActiveCameraStream = typeof activeCameraStream.$inferSelect

// نافذة اعتبار الكاميرا "متصلة حالياً" (بالثواني): آخر إرسال خلال آخر دقيقتين.
const ACTIVE_WINDOW_SECONDS = 120

// تحديث (أو إنشاء) سجل الكاميرا المتصلة مع نبضة الاتصال (heartbeat).
// إذا مُرِّر lastFrameUrl (رابط Blob) يُحدَّث، وإلا يُحتفظ بالرابط الحالي كما هو
// حتى لا يمحو استدعاءُ التحليل رابطَ الإطار المرفوع إلى Blob.
export async function touchCameraStream(input: {
  cameraId: string
  cameraLocation: string
  lastFrameUrl?: string
}): Promise<void> {
  const userId = await requireModuleUserId("ai_monitoring")
  const cameraId = (input.cameraId || "كاميرا الهاتف").slice(0, 120)
  const cameraLocation = (input.cameraLocation || "").slice(0, 200)
  const hasFrame = typeof input.lastFrameUrl === "string" && input.lastFrameUrl.length > 0
  const lastFrameUrl = hasFrame ? (input.lastFrameUrl as string) : ""

  const set: Partial<typeof activeCameraStream.$inferInsert> = {
    cameraLocation,
    lastSeenAt: new Date(),
  }
  if (hasFrame) set.lastFrameUrl = lastFrameUrl

  await db
    .insert(activeCameraStream)
    .values({ userId, cameraId, cameraLocation, lastFrameUrl, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: [activeCameraStream.userId, activeCameraStream.cameraId],
      set,
    })
}

// الكاميرات المتصلة حالياً (آخر إرسال خلال نافذة الاعتبار)، الأحدث أولاً.
export async function getActiveCameraStreams(): Promise<ActiveCameraStream[]> {
  const userId = await requireModuleUserId("ai_monitoring")
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
  const userId = await requireModuleUserId("ai_monitoring")
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

// حفظ اكتشاف جديد قادم من تحليل الكاميرا. يُستدعى من مسار /api/ai-monitoring/analyze.
export async function saveDetection(input: {
  cameraId: string
  cameraLocation: string
  detectionType: string
  severity?: string
  confidenceScore: number
  snapshotUrl?: string
  notes?: string
}): Promise<AiDetection> {
  const userId = await requireModuleUserId("ai_monitoring")

  const detectionType = (VALID_TYPES as string[]).includes(input.detectionType)
    ? (input.detectionType as DetectionType)
    : "no_ppe"
  const severity =
    input.severity && (VALID_SEVERITY as readonly string[]).includes(input.severity)
      ? input.severity
      : severityByType[detectionType]
  const confidence = Math.max(0, Math.min(100, Math.round(input.confidenceScore || 0)))
  const detectionId = await nextDetectionId()

  const [row] = await db
    .insert(aiDetection)
    .values({
      userId,
      detectionId,
      cameraId: input.cameraId?.slice(0, 120) || "",
      cameraLocation: input.cameraLocation?.slice(0, 200) || "",
      detectionType,
      severity,
      confidenceScore: confidence,
      snapshotUrl: input.snapshotUrl || "",
      notes: input.notes?.slice(0, 1000) || "",
      status: "new",
    })
    .returning()

  revalidatePath("/ai-monitoring")
  return row
}

// تحديث حالة اكتشاف (اطّلاع / معالجة / إنذار خاطئ).
export async function updateDetectionStatus(id: number, status: string, notes?: string) {
  const userId = await requireModuleUserId("ai_monitoring")
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
  const userId = await requireModuleUserId("ai_monitoring")
  const manager = await isManager(userId)
  const where = manager ? eq(aiDetection.id, id) : and(eq(aiDetection.id, id), eq(aiDetection.userId, userId))
  await db.delete(aiDetection).where(where)
  revalidatePath("/ai-monitoring")
}
