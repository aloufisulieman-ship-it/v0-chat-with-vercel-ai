"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { attachment } from "@/lib/db/schema"
import { and, asc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { put, del } from "@vercel/blob"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type AttachmentRow = {
  id: number
  module: string
  recordId: number
  kind: string
  pathname: string
  url: string
  filename: string
  contentType: string
  size: number
  createdAt: Date
}

// Fetch all attachments for a single record.
export async function getAttachments(module: string, recordId: number): Promise<AttachmentRow[]> {
  const userId = await getUserId()
  return db
    .select()
    .from(attachment)
    .where(and(eq(attachment.userId, userId), eq(attachment.module, module), eq(attachment.recordId, recordId)))
    .orderBy(asc(attachment.createdAt))
}

// Fetch attachments for many records at once (used by list pages).
export async function getAttachmentsForModule(module: string): Promise<AttachmentRow[]> {
  const userId = await getUserId()
  return db
    .select()
    .from(attachment)
    .where(and(eq(attachment.userId, userId), eq(attachment.module, module)))
    .orderBy(asc(attachment.createdAt))
}

// Upload one file (photo or signature) to Vercel Blob and record it in the DB.
export async function uploadAttachment(formData: FormData) {
  const userId = await getUserId()
  const module = String(formData.get("module") || "")
  const recordId = Number(formData.get("recordId") || 0)
  const kind = String(formData.get("kind") || "photo")
  const file = formData.get("file") as File | null

  if (!module || !recordId || !file) {
    throw new Error("بيانات المرفق غير مكتملة")
  }

  const safeName = file.name?.replace(/[^\w.\-]+/g, "_") || `${kind}.png`
  const key = `hse/${userId}/${module}/${recordId}/${Date.now()}-${safeName}`

  const blob = await put(key, file, { access: "private", addRandomSuffix: true })

  const [row] = await db
    .insert(attachment)
    .values({
      userId,
      module,
      recordId,
      kind,
      pathname: blob.pathname,
      url: blob.url,
      filename: file.name || safeName,
      contentType: file.type || "image/png",
      size: file.size || 0,
    })
    .returning()

  return row
}

export async function deleteAttachment(id: number) {
  const userId = await getUserId()
  const rows = await db
    .select()
    .from(attachment)
    .where(and(eq(attachment.id, id), eq(attachment.userId, userId)))
    .limit(1)

  const row = rows[0]
  if (!row) return

  try {
    if (row.url) await del(row.url)
  } catch {
    // ignore blob deletion errors; still remove the DB row
  }

  await db.delete(attachment).where(and(eq(attachment.id, id), eq(attachment.userId, userId)))
}
