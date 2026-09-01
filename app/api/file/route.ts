import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { attachment } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/session"

// Serves attachment files only to the authenticated owner of the attachment,
// scoped to the caller's organization for tenant isolation.
//
// المتجر المربوط عام (public)، لكن هذا الوسيط يبقى هو نقطة التقديم الوحيدة كي يظل
// التحكم بالوصول على مستوى التطبيق: لا يُقدَّم أي ملف قبل التحقق أن المرفق يخص
// المستخدم الحالي داخل مؤسسته، ثم نجلب المحتوى من رابط Blob العام المخزَّن ونبثّه
// عبر الخادم فلا يُكشف رابط التخزين للعميل.
export async function GET(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pathname = request.nextUrl.searchParams.get("pathname")
  if (!pathname) {
    return NextResponse.json({ error: "Missing pathname" }, { status: 400 })
  }

  // Ensure the file belongs to this user within their organization, and get its URL.
  const rows = await db
    .select({ url: attachment.url, contentType: attachment.contentType })
    .from(attachment)
    .where(
      and(
        eq(attachment.pathname, pathname),
        eq(attachment.organizationId, current.organizationId),
        eq(attachment.userId, current.id),
      ),
    )
    .limit(1)

  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const upstream = await fetch(rows[0].url, {
      headers: { "if-none-match": request.headers.get("if-none-match") ?? "" },
    })

    if (upstream.status === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: upstream.headers.get("etag") ?? "",
          "Cache-Control": "private, no-cache",
        },
      })
    }

    if (!upstream.ok || !upstream.body) {
      return new NextResponse("Not found", { status: 404 })
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? rows[0].contentType ?? "application/octet-stream",
        ETag: upstream.headers.get("etag") ?? "",
        "Cache-Control": "private, no-cache",
      },
    })
  } catch (error) {
    console.error("Error serving file:", error)
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 })
  }
}
