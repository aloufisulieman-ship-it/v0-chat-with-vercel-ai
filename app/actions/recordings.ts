"use server"

import { db } from "@/lib/db"
import { videoRecording, videoScreenshot } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { put, del } from "@vercel/blob"
import { revalidatePath } from "next/cache"
import { requireUser, requireModuleScope, assertWritable } from "@/lib/session"

export type VideoRecordingDto = {
  id: number
  cameraId: string
  cameraName: string
  videoUrl: string
  posterUrl: string
  durationSeconds: number
  fileSizeBytes: number
  recordedBy: string
  recordedAt: string
  screenshotCount: number
}

export type RecordingsFilter = {
  camera?: string
  from?: string // YYYY-MM-DD
  to?: string // YYYY-MM-DD
  page?: number
  pageSize?: number
}

export type RecordingsPage = {
  items: VideoRecordingDto[]
  total: number
  page: number
  pageSize: number
  cameras: string[]
}

export type VideoScreenshotDto = {
  id: number
  recordingId: number
  cameraId: string
  imageUrl: string
  atSeconds: number
  linkedViolationId: number | null
  capturedAt: string
}

// إنشاء سجل تسجيل بعد رفع الفيديو مباشرةً إلى Blob من المتصفح.
// متاح لأي مستخدم مسجّل دخول (الموظف المصوّر).
export async function createRecording(input: {
  cameraId: string
  cameraName: string
  videoUrl: string
  posterUrl?: string
  durationSeconds: number
  fileSizeBytes: number
}): Promise<{ id: number }> {
  await assertWritable()
  const u = await requireUser()
  if (!input.videoUrl || !input.videoUrl.startsWith("http")) {
    throw new Error("رابط الفيديو غير صالح")
  }
  const [row] = await db
    .insert(videoRecording)
    .values({
      userId: u.id,
      organizationId: u.organizationId,
      cameraId: (input.cameraId || "").slice(0, 120),
      cameraName: (input.cameraName || "كاميرا الهاتف").slice(0, 160),
      videoUrl: input.videoUrl,
      posterUrl: input.posterUrl?.startsWith("http") ? input.posterUrl : "",
      durationSeconds: Math.max(0, Math.round(input.durationSeconds || 0)),
      fileSizeBytes: Math.max(0, Math.round(input.fileSizeBytes || 0)),
      recordedBy: u.name || "مستخدم",
    })
    .returning({ id: videoRecording.id })
  revalidatePath("/ai-monitoring/recordings")
  return { id: row.id }
}

function toDto(r: typeof videoRecording.$inferSelect, screenshotCount: number): VideoRecordingDto {
  return {
    id: r.id,
    cameraId: r.cameraId,
    cameraName: r.cameraName,
    videoUrl: r.videoUrl,
    posterUrl: r.posterUrl ?? "",
    durationSeconds: r.durationSeconds,
    fileSizeBytes: r.fileSizeBytes,
    recordedBy: r.recordedBy,
    recordedAt: (r.recordedAt as unknown as Date)?.toISOString?.() ?? String(r.recordedAt),
    screenshotCount,
  }
}

async function screenshotCounts(organizationId: string, userId: string): Promise<Map<number, number>> {
  const shots = await db
    .select({ recordingId: videoScreenshot.recordingId })
    .from(videoScreenshot)
    .where(and(eq(videoScreenshot.organizationId, organizationId), eq(videoScreenshot.userId, userId)))
  const countByRec = new Map<number, number>()
  for (const s of shots) countByRec.set(s.recordingId, (countByRec.get(s.recordingId) ?? 0) + 1)
  return countByRec
}

// قائمة التسجيلات كاملة — مقصورة على المراجع وعلى حسابه داخل مؤسسته (للتحميل المبدئي).
export async function getRecordings(): Promise<VideoRecordingDto[]> {
    const { userId, organizationId } = await requireModuleScope("ai_monitoring")
  const rows = await db
    .select()
    .from(videoRecording)
    .where(and(eq(videoRecording.organizationId, organizationId), eq(videoRecording.userId, userId)))
    .orderBy(desc(videoRecording.recordedAt))
  const countByRec = await screenshotCounts(organizationId, userId)
  return rows.map((r) => toDto(r, countByRec.get(r.id) ?? 0))
}

// قائمة مصفّاة ومُقسّمة لصفحات — تصفية بالكاميرا ونطاق التاريخ.
export async function getRecordingsPage(filter: RecordingsFilter = {}): Promise<RecordingsPage> {
    const { userId, organizationId } = await requireModuleScope("ai_monitoring")
  const page = Math.max(1, Math.round(filter.page ?? 1))
  const pageSize = Math.min(48, Math.max(6, Math.round(filter.pageSize ?? 12)))

  // جلب كل تسجيلات الحساب مرة واحدة ثم التصفية/التقسيم في الذاكرة (الحجم لكل حساب محدود).
  const all = await db
    .select()
    .from(videoRecording)
    .where(and(eq(videoRecording.organizationId, organizationId), eq(videoRecording.userId, userId)))
    .orderBy(desc(videoRecording.recordedAt))

  const cameras = Array.from(new Set(all.map((r) => r.cameraName).filter(Boolean))).sort()

  const fromTs = filter.from ? new Date(`${filter.from}T00:00:00`).getTime() : null
  const toTs = filter.to ? new Date(`${filter.to}T23:59:59.999`).getTime() : null

  const filtered = all.filter((r) => {
    if (filter.camera && filter.camera !== "all" && r.cameraName !== filter.camera) return false
    const t = (r.recordedAt as unknown as Date)?.getTime?.() ?? 0
    if (fromTs != null && t < fromTs) return false
    if (toTs != null && t > toTs) return false
    return true
  })

  const total = filtered.length
  const start = (page - 1) * pageSize
  const pageRows = filtered.slice(start, start + pageSize)
  const countByRec = await screenshotCounts(organizationId, userId)

  return {
    items: pageRows.map((r) => toDto(r, countByRec.get(r.id) ?? 0)),
    total,
    page,
    pageSize,
    cameras,
  }
}

// لقطات تسجيل معيّن — للمراجع صاحب الحساب فقط.
export async function getRecordingScreenshots(recordingId: number): Promise<VideoScreenshotDto[]> {
    const { userId, organizationId } = await requireModuleScope("ai_monitoring")
  const rows = await db
    .select()
    .from(videoScreenshot)
    .where(and(eq(videoScreenshot.organizationId, organizationId), eq(videoScreenshot.recordingId, recordingId), eq(videoScreenshot.userId, userId)))
    .orderBy(desc(videoScreenshot.capturedAt))
  return rows.map((r) => ({
    id: r.id,
    recordingId: r.recordingId,
    cameraId: r.cameraId,
    imageUrl: r.imageUrl,
    atSeconds: r.atSeconds,
    linkedViolationId: r.linkedViolationId ?? null,
    capturedAt: (r.capturedAt as unknown as Date)?.toISOString?.() ?? String(r.capturedAt),
  }))
}

// حفظ لقطة مُلتقطة من مشغّل الفيديو (Canvas → JPEG data URL) إلى Blob.
export async function saveScreenshot(input: {
  recordingId: number
  dataUrl: string
  atSeconds: number
}): Promise<VideoScreenshotDto> {
  await assertWritable()
    const { userId, organizationId } = await requireModuleScope("ai_monitoring")

  // التأكد من ملكية التسجيل قبل ربط اللقطة به.
  const rec = (
    await db
      .select({ id: videoRecording.id, cameraId: videoRecording.cameraId })
      .from(videoRecording)
      .where(and(eq(videoRecording.organizationId, organizationId), eq(videoRecording.id, input.recordingId), eq(videoRecording.userId, userId)))
      .limit(1)
  )[0]
  if (!rec) throw new Error("التسجيل غير موجود أو لا تملك صلاحيته")

  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(input.dataUrl || "")
  if (!m) throw new Error("تنسيق الصورة غير صالح")
  const buffer = Buffer.from(m[2], "base64")

  const ts = Date.now()
  const path = `recordings/${encodeURIComponent(rec.cameraId || "camera")}/screenshots/${ts}.jpg`
  const blob = await put(path, buffer, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  const [row] = await db
    .insert(videoScreenshot)
    .values({
      userId,
      organizationId,
      recordingId: input.recordingId,
      cameraId: rec.cameraId,
      imageUrl: blob.url,
      atSeconds: Math.max(0, Math.round(input.atSeconds || 0)),
    })
    .returning()

  revalidatePath("/ai-monitoring/recordings")
  return {
    id: row.id,
    recordingId: row.recordingId,
    cameraId: row.cameraId,
    imageUrl: row.imageUrl,
    atSeconds: row.atSeconds,
    linkedViolationId: row.linkedViolationId ?? null,
    capturedAt: (row.capturedAt as unknown as Date)?.toISOString?.() ?? String(row.capturedAt),
  }
}

// حذف تسجيل بالكامل: الفيديو + كل لقطاته من Blob وقاع��ة البيانات.
// مقصور على المراجع صاحب الحساب.
export async function deleteRecording(id: number): Promise<void> {
  await assertWritable()
    const { userId, organizationId } = await requireModuleScope("ai_monitoring")
  const rec = (
    await db
      .select()
      .from(videoRecording)
      .where(and(eq(videoRecording.organizationId, organizationId), eq(videoRecording.id, id), eq(videoRecording.userId, userId)))
      .limit(1)
  )[0]
  if (!rec) throw new Error("التسجيل غير موجود أو لا تملك صلاحيته")

  const shots = await db
    .select({ imageUrl: videoScreenshot.imageUrl })
    .from(videoScreenshot)
    .where(and(eq(videoScreenshot.organizationId, organizationId), eq(videoScreenshot.recordingId, id), eq(videoScreenshot.userId, userId)))

  // حذف ملفات Blob (تجاهل الأخطاء الفردية حتى لا يتعطّل الحذف من القاعدة).
  const urls = [rec.videoUrl, ...shots.map((s) => s.imageUrl)].filter(Boolean)
  await Promise.all(
    urls.map(async (url) => {
      try {
        await del(url)
      } catch {
        /* الملف قد يكون محذوفاً مسبقاً */
      }
    }),
  )

  await db.delete(videoScreenshot).where(and(eq(videoScreenshot.organizationId, organizationId), eq(videoScreenshot.recordingId, id), eq(videoScreenshot.userId, userId)))
  await db.delete(videoRecording).where(and(eq(videoRecording.organizationId, organizationId), eq(videoRecording.id, id), eq(videoRecording.userId, userId)))
  revalidatePath("/ai-monitoring/recordings")
}

// حذف لقطة واحدة (من Blob والقاعدة).
export async function deleteScreenshot(id: number): Promise<void> {
  await assertWritable()
    const { userId, organizationId } = await requireModuleScope("ai_monitoring")
  const shot = (
    await db
      .select()
      .from(videoScreenshot)
      .where(and(eq(videoScreenshot.organizationId, organizationId), eq(videoScreenshot.id, id), eq(videoScreenshot.userId, userId)))
      .limit(1)
  )[0]
  if (!shot) throw new Error("اللقطة غير موجودة")
  try {
    await del(shot.imageUrl)
  } catch {
    /* تجاهل */
  }
  await db.delete(videoScreenshot).where(and(eq(videoScreenshot.organizationId, organizationId), eq(videoScreenshot.id, id), eq(videoScreenshot.userId, userId)))
  revalidatePath("/ai-monitoring/recordings")
}

// ربط لقطة بمخالفة أُنشئت منها (لأغراض العرض فقط).
export async function linkScreenshotToViolation(screenshotId: number): Promise<void> {
  await assertWritable()
    const { userId, organizationId } = await requireModuleScope("ai_monitoring")
  // نضع علامة الربط دون تخزين معرّف حقيقي (المخالفة تُنشأ عبر نظام المخالفات المستقل).
  await db
    .update(videoScreenshot)
    .set({ linkedViolationId: -1 })
    .where(and(eq(videoScreenshot.organizationId, organizationId), eq(videoScreenshot.id, screenshotId), eq(videoScreenshot.userId, userId)))
  revalidatePath("/ai-monitoring/recordings")
}
