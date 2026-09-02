"use server"

import { db } from "@/lib/db"
import { attachment } from "@/lib/db/schema"
import { and, asc, eq } from "drizzle-orm"
import { put, del } from "@vercel/blob"
import { requireScope, assertWritable } from "@/lib/session"
import { hasRoleSignature } from "@/lib/signature-check"
import { roleKindFor } from "@/lib/signature-roles"
import { assertNotArchived } from "@/app/actions/lifecycle"

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

// تحقق خفيف (للواجهة) من وجود توقيع دور معيّن على سجل، على مستوى المؤسسة.
// يُستخدم قبل محاولة إغلاق مخالفة لعرض تنبيه مبكر إن غاب توقيع الموظف المعني.
export async function hasRecordRoleSignature(
  module: string,
  recordId: number,
  roleKey: string,
): Promise<boolean> {
  const { userId, organizationId } = await requireScope()
  return hasRoleSignature({ organizationId, userId, module, recordId, roleKey })
}

// جلب توقيع دور معيّن على سجل للعرض داخل بطاقة المعالجة.
// النطاق بالمستخدم + المؤسسة ليطابق نطاق الرفع ونطاق العرض (وسيط /api/file) ومنطق
// التحقق عند الإغلاق؛ فما يُعرض في البطاقة هو نفسه ما يفرضه شرط الإغلاق تماماً.
export async function getRecordRoleSignature(
  module: string,
  recordId: number,
  roleKey: string,
): Promise<{ id: number; pathname: string; url: string } | null> {
  const { userId, organizationId } = await requireScope()
  const rows = await db
    .select({ id: attachment.id, pathname: attachment.pathname, url: attachment.url })
    .from(attachment)
    .where(
      and(
        eq(attachment.organizationId, organizationId),
        eq(attachment.userId, userId),
        eq(attachment.module, module),
        eq(attachment.recordId, recordId),
        eq(attachment.kind, roleKindFor(roleKey)),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

// Fetch all attachments for a single record.
export async function getAttachments(module: string, recordId: number): Promise<AttachmentRow[]> {
  const { userId, organizationId } = await requireScope()
  return db
    .select()
    .from(attachment)
    .where(and(eq(attachment.organizationId, organizationId), eq(attachment.userId, userId), eq(attachment.module, module), eq(attachment.recordId, recordId)))
    .orderBy(asc(attachment.createdAt))
}

// Fetch attachments for many records at once (used by list pages).
export async function getAttachmentsForModule(module: string): Promise<AttachmentRow[]> {
  const { userId, organizationId } = await requireScope()
  return db
    .select()
    .from(attachment)
    .where(and(eq(attachment.organizationId, organizationId), eq(attachment.userId, userId), eq(attachment.module, module)))
    .orderBy(asc(attachment.createdAt))
}

// Upload one file (photo or signature) to Vercel Blob and record it in the DB.
export async function uploadAttachment(formData: FormData) {
  await assertWritable()
  const { userId, organizationId } = await requireScope()
  const module = String(formData.get("module") || "")
  const recordId = Number(formData.get("recordId") || 0)
  const kind = String(formData.get("kind") || "photo")
  const file = formData.get("file") as File | null

  if (!module || !recordId || !file) {
    throw new Error("بيانات المرفق غير مكتملة")
  }
  // السجلات المؤرشفة للقراءة فقط — لا مرفقات جديدة.
  if (module === "violations" || module === "incidents") {
    await assertNotArchived(module, recordId, organizationId)
  }

  const safeName = file.name?.replace(/[^\w.\-]+/g, "_") || `${kind}.png`
  const key = `hse/${userId}/${module}/${recordId}/${Date.now()}-${safeName}`

  // المتجر المربوط عام (public) — يجب أن يطابق access نوع المتجر. التحكم بالوصول
  // يبقى على مستوى التطبيق عبر وسيط /api/file المقيّد بالمستخدم/المؤسسة.
  const blob = await put(key, file, { access: "public", addRandomSuffix: true })

  const [row] = await db
    .insert(attachment)
    .values({
      userId,
      organizationId,
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
  await assertWritable()
  const { userId, organizationId } = await requireScope()
  const rows = await db
    .select()
    .from(attachment)
    .where(and(eq(attachment.organizationId, organizationId), eq(attachment.id, id), eq(attachment.userId, userId)))
    .limit(1)

  const row = rows[0]
  if (!row) return
  if (row.module === "violations" || row.module === "incidents") {
    await assertNotArchived(row.module, row.recordId, organizationId)
  }

  try {
    if (row.url) await del(row.url)
  } catch {
    // ignore blob deletion errors; still remove the DB row
  }

  await db.delete(attachment).where(and(eq(attachment.organizationId, organizationId), eq(attachment.id, id), eq(attachment.userId, userId)))
}
