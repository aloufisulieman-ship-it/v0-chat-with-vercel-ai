'use server'

import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { aiDetection, aiMonitoringNotification, user } from '@/lib/db/schema'
import { requireModuleUserId, requireUser } from '@/lib/session'

export type DetectionInput = {
  cameraId: string
  cameraLocation: string
  detectionType: string
  severity: string
  confidenceScore: number
  snapshotUrl: string
  boundingBox?: { x: number; y: number; width: number; height: number } | null
  notes?: string
}

export async function createDetection(input: DetectionInput, createdBy = 'camera-service') {
  const year = new Date().getFullYear()
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(aiDetection)
  const detectionId = `AID-${year}-${String(Number(count) + 1).padStart(3, '0')}`
  const [created] = await db.insert(aiDetection).values({
    detectionId, cameraId: input.cameraId, cameraLocation: input.cameraLocation,
    detectionType: input.detectionType, severity: input.severity,
    confidenceScore: String(input.confidenceScore), snapshotUrl: input.snapshotUrl,
    boundingBox: input.boundingBox ? JSON.stringify(input.boundingBox) : null,
    notes: input.notes ?? '', createdBy,
  }).returning()

  if (['high', 'critical'].includes(input.severity)) {
    const recipients = await db.select({ id: user.id }).from(user).where(and(
      eq(user.status, 'approved'),
      or(inArray(user.role, ['admin', 'manager']), inArray(user.department, ['inspector', 'operations', 'control_room'])),
    ))
    if (recipients.length) await db.insert(aiMonitoringNotification).values(recipients.map((recipient) => ({
      userId: recipient.id, detectionId: created.id,
      title: input.severity === 'critical' ? 'تنبيه كاميرا حرج' : 'تنبيه كاميرا عالي الخطورة',
      message: `${input.cameraLocation} — ${detectionId}`,
    }))).onConflictDoNothing()
  }
  revalidatePath('/ai-monitoring')
  return created
}

export async function getDetections() {
  await requireModuleUserId('ai_monitoring')
  return db.select().from(aiDetection).orderBy(desc(aiDetection.detectedAt)).limit(200)
}

export async function updateDetectionStatus(id: number, status: 'acknowledged' | 'resolved' | 'false_positive', notes = '') {
  const userId = await requireModuleUserId('ai_monitoring')
  await db.update(aiDetection).set({
    status, notes,
    ...(status === 'acknowledged' ? { acknowledgedBy: userId } : {}),
    ...(status === 'resolved' ? { resolvedBy: userId } : {}),
  }).where(eq(aiDetection.id, id))
  revalidatePath('/ai-monitoring')
}

export async function getUnreadAiNotifications() {
  const current = await requireUser()
  return db.select().from(aiMonitoringNotification)
    .where(and(eq(aiMonitoringNotification.userId, current.id), isNull(aiMonitoringNotification.readAt)))
    .orderBy(desc(aiMonitoringNotification.createdAt))
}

export async function markAiNotificationsRead() {
  const current = await requireUser()
  await db.update(aiMonitoringNotification).set({ readAt: new Date() })
    .where(and(eq(aiMonitoringNotification.userId, current.id), isNull(aiMonitoringNotification.readAt)))
}
