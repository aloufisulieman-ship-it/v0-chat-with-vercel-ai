import { NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { getCurrentUser, isHseReviewer } from "@/lib/session"

export const runtime = "nodejs"
export const maxDuration = 30

// يلتقط المدير/المراجع لقطةً من البث الحي المباشر لكاميرا مفتش، فتُرفَع كصورة
// دائمة (باسم فريد لا يُستبدَل) إلى Vercel Blob لتُستخدم كدليل في مخالفة جديدة.
// مقصور على مسؤولي HSE (مدير/أدمن) مثل بقية صفحات المراجعة.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول لالتقاط لقطة." }, { status: 401 })
  }
  if (!isHseReviewer(user.role)) {
    return NextResponse.json(
      { error: "التقاط اللقطات وإنشاء المخالفات مقصور على مسؤول HSE (مدير/أدمن)." },
      { status: 403 },
    )
  }

  try {
    const body = (await req.json()) as { image?: string; cameraId?: string }
    const image = body.image
    if (!image || typeof image !== "string" || !image.startsWith("data:image")) {
      return NextResponse.json({ error: "صورة غير صالحة" }, { status: 400 })
    }
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(image)
    if (!match) {
      return NextResponse.json({ error: "تنسيق صورة غير مدعوم" }, { status: 400 })
    }
    const buffer = Buffer.from(match[2], "base64")

    const cameraId = (body.cameraId || "camera").toString().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "camera"
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    // مسار فريد (addRandomSuffix) حتى تبقى اللقطة دليلاً دائماً ولا يُستبدَل.
    const pathname = `violation-evidence/${cameraId}/${stamp}.jpg`

    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: true,
    })

    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.log("[v0] live-snapshot error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: "تعذّر حفظ اللقطة" }, { status: 500 })
  }
}
