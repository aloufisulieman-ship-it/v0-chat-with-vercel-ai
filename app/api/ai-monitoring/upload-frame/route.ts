import { NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { touchCameraStream } from "@/app/actions/ai-monitoring"
import { requireUser } from "@/lib/session"
import { sessionCameraId } from "@/lib/camera-session"

export const runtime = "nodejs"
export const maxDuration = 30

// يستقبل إطاراً واحداً (JPEG بترميز base64) من كاميرا الهاتف، يرفعه إلى Vercel Blob
// على مسار ثابت لكل كاميرا (استبدال الملف نفسه في كل مرة لتوفير المساحة)، ثم يحدّث
// نبضة الاتصال في قاعدة البيانات برابط الإطار الأحدث. يُستدعى كل 1-2 ثانية.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      image?: string
      inspectorName?: string
      cameraLocation?: string
    }

    const image = body.image
    if (!image || typeof image !== "string" || !image.startsWith("data:image")) {
      return NextResponse.json({ error: "صورة غير صالحة" }, { status: 400 })
    }

    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(image)
    if (!match) {
      return NextResponse.json({ error: "تنسيق صورة غير مدعوم" }, { status: 400 })
    }
    const base64 = match[2]
    const buffer = Buffer.from(base64, "base64")

    const inspectorName = (body.inspectorName || "كاميرا الهاتف").toString().slice(0, 160)
    const cameraLocation = (body.cameraLocation || "").toString().slice(0, 200)

    // مسار ثابت لكل جلسة (مشتقّ من الحساب + اسم المفتش) حتى تُستبدل الصورة نفسها في كل رفع
    // ويحصل كل مفتش على مسار إطار خاص به عند مشاركة نفس الرابط/الحساب.
    const userId = (await requireUser()).id
    const cameraId = sessionCameraId(userId, inspectorName)
    const pathname = `cameras/${encodeURIComponent(cameraId)}/latest.jpg`

    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0, // نريد إطاراً حديثاً دائماً؛ يُكسَر الكاش من العميل أيضاً
    })

    // تحديث نبضة الاتصال برابط الإطار الأحدث.
    await touchCameraStream({ inspectorName, cameraLocation, lastFrameUrl: blob.url })

    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.log("[v0] upload-frame error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: "تعذّر رفع الإطار" }, { status: 500 })
  }
}
