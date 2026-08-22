import { type NextRequest, NextResponse } from "next/server"
import { get } from "@vercel/blob"
import { db } from "@/lib/db"
import { attachment } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/session"

// Serves private blob files only to the authenticated owner of the attachment,
// scoped to the caller's organization for tenant isolation.
export async function GET(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pathname = request.nextUrl.searchParams.get("pathname")
  if (!pathname) {
    return NextResponse.json({ error: "Missing pathname" }, { status: 400 })
  }

  // Ensure the file belongs to this user within their organization.
  const rows = await db
    .select({ id: attachment.id })
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
    const result = await get(pathname, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    })

    if (!result) {
      return new NextResponse("Not found", { status: 404 })
    }

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: result.blob.etag, "Cache-Control": "private, no-cache" },
      })
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        ETag: result.blob.etag,
        "Cache-Control": "private, no-cache",
      },
    })
  } catch (error) {
    console.error("Error serving file:", error)
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 })
  }
}
