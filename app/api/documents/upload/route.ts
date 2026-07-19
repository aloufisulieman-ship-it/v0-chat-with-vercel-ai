import { del, put } from "@vercel/blob"
import { NextResponse, type NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { document, documentVersion } from "@/lib/db/schema"
import { requireModule } from "@/lib/session"

const MAX_FILE_SIZE = 20 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
])

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-")
}

export async function POST(request: NextRequest) {
  let uploadedPath = ""
  try {
    const currentUser = await requireModule("documents")
    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "اختر ملفاً للرفع" }, { status: 400 })
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "نوع الملف غير مدعوم" }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "حجم الملف يجب ألا يتجاوز 20 ميجابايت" }, { status: 400 })

    const documentId = Number(formData.get("documentId"))
    const isNewVersion = Number.isFinite(documentId) && documentId > 0
    if (isNewVersion && currentUser.role !== "admin") return NextResponse.json({ error: "رفع إصدار جديد متاح للمدير فقط" }, { status: 403 })

    const key = `documents/${currentUser.id}/${isNewVersion ? documentId : "new"}/${Date.now()}-${safeName(file.name)}`
    const blob = await put(key, file, { access: "private", addRandomSuffix: true })
    uploadedPath = blob.pathname

    if (isNewVersion) {
      const [owned] = await db.select().from(document).where(and(eq(document.id, documentId), eq(document.userId, currentUser.id))).limit(1)
      if (!owned) throw new Error("الوثيقة غير موجودة")
      const nextVersion = owned.currentVersion + 1
      await db.transaction(async (tx) => {
        await tx.insert(documentVersion).values({
          userId: currentUser.id, documentId, versionNumber: nextVersion, blobPathname: blob.pathname,
          originalFilename: file.name, fileType: file.type, fileSize: file.size, uploadedBy: currentUser.id,
          uploaderName: currentUser.name, notes: String(formData.get("notes") ?? "").trim(),
        })
        await tx.update(document).set({
          version: String(formData.get("version") ?? `${nextVersion}.0`), currentVersion: nextVersion,
          blobPathname: blob.pathname, originalFilename: file.name, fileType: file.type, fileSize: file.size,
          uploadedBy: currentUser.id, uploaderName: currentUser.name, uploadedAt: new Date(), updatedAt: new Date(),
        }).where(and(eq(document.id, documentId), eq(document.userId, currentUser.id)))
      })
      return NextResponse.json({ success: true })
    }

    const title = String(formData.get("title") ?? "").trim()
    if (!title) throw new Error("اسم الوثيقة مطلوب")
    await db.transaction(async (tx) => {
      const [created] = await tx.insert(document).values({
        userId: currentUser.id, title, category: String(formData.get("category") ?? "").trim(),
        version: String(formData.get("version") ?? "1.0").trim() || "1.0", owner: String(formData.get("owner") ?? "").trim(),
        status: String(formData.get("status") ?? "active"), reviewDate: String(formData.get("reviewDate") ?? "") || null,
        description: String(formData.get("description") ?? "").trim(), fileType: file.type, fileSize: file.size,
        blobPathname: blob.pathname, originalFilename: file.name, uploadedBy: currentUser.id,
        uploaderName: currentUser.name, currentVersion: 1,
      }).returning()
      await tx.insert(documentVersion).values({
        userId: currentUser.id, documentId: created.id, versionNumber: 1, blobPathname: blob.pathname,
        originalFilename: file.name, fileType: file.type, fileSize: file.size, uploadedBy: currentUser.id,
        uploaderName: currentUser.name, notes: "الإصدار الأول",
      })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (uploadedPath) await del(uploadedPath).catch(() => undefined)
    const message = error instanceof Error ? error.message : "تعذر رفع الوثيقة"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
