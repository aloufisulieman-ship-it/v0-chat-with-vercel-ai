import { get } from "@vercel/blob"
import { NextResponse, type NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { document, documentVersion } from "@/lib/db/schema"
import { requireModule } from "@/lib/session"

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireModule("documents")
    const documentId = Number(request.nextUrl.searchParams.get("documentId"))
    const versionId = Number(request.nextUrl.searchParams.get("versionId"))
    const download = request.nextUrl.searchParams.get("download") === "1"
    if (!Number.isFinite(documentId)) return NextResponse.json({ error: "معرّف الوثيقة مطلوب" }, { status: 400 })

    const [owned] = await db.select().from(document).where(and(eq(document.id, documentId), eq(document.userId, currentUser.id))).limit(1)
    if (!owned) return NextResponse.json({ error: "الوثيقة غير موجودة" }, { status: 404 })

    let pathname = owned.blobPathname
    let filename = owned.originalFilename
    if (Number.isFinite(versionId) && versionId > 0) {
      const [version] = await db.select().from(documentVersion).where(and(eq(documentVersion.id, versionId), eq(documentVersion.documentId, documentId), eq(documentVersion.userId, currentUser.id))).limit(1)
      if (!version) return NextResponse.json({ error: "الإصدار غير موجود" }, { status: 404 })
      pathname = version.blobPathname
      filename = version.originalFilename
    }
    if (!pathname) return NextResponse.json({ error: "لا يوجد ملف مرتبط بهذه الوثيقة" }, { status: 404 })

    const result = await get(pathname, { access: "private", ifNoneMatch: request.headers.get("if-none-match") ?? undefined })
    if (!result) return new NextResponse("Not found", { status: 404 })
    if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag, "Cache-Control": "private, no-cache" } })

    const headers = new Headers({
      "Content-Type": result.blob.contentType || "application/octet-stream",
      ETag: result.blob.etag,
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    })
    if (download) headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    return new NextResponse(result.stream, { headers })
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }
}
