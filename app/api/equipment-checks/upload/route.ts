import { NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { requireUser } from "@/lib/session"

export const runtime = "nodejs"
export const maxDuration = 30

// يستقبل صورة (data URL) لتوقيع أو دليل عيب في الفحص اليومي، ويرفعها إلى Vercel Blob
// بمسار عشوائي دائم. يُرجع الرابط ليُخزَّن في سجل الفحص/البند.
export async function POST(req: Request) {
  try {
    await requireUser()
    const body = (await req.json()) as { image?: string; kind?: string }
    const image = body.image
    if (!image || typeof image !== "string" || !image.startsWith("data:image")) {
      return NextResponse.json({ error: "صورة غير صالحة" }, { status: 400 })
    }
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(image)
    if (!match) {
      return NextResponse.json({ error: "تنسيق صورة غير مدعوم" }, { status: 400 })
    }
    const contentType = match[1]
    const buffer = Buffer.from(match[2], "base64")
    const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") || "png"
    const kind = (body.kind || "photo").replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || "photo"

    const blob = await put(`equipment-checks/${kind}/${Date.now()}.${ext}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    })
    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.log("[v0] equipment-check upload error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: "تعذّر رفع الصورة" }, { status: 500 })
  }
}
