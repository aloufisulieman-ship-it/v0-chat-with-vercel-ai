import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/session"

// نقطة إصدار توكن رفع مباشر من المتصفح إلى Vercel Blob (تتجاوز حد 4.5MB لمعالجات الطلب).
// الرفع متاح لأي مستخدم مسجّل دخول (الموظف المصوّر).
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        await requireUser()
        return {
          // نُدرج صيغاً بلاحقة الترميز أيضاً احتياطاً لأن بعض المتصفحات ترسل النوع كاملاً
          // (مثل "video/webm;codecs=vp9,opus") ومطابقة Vercel Blob تامة.
          allowedContentTypes: [
            "video/webm",
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/mp4",
            "video/x-matroska",
            "video/ogg",
            "image/jpeg",
          ],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
          addRandomSuffix: false,
        }
      },
      // لا يُعتمد على هذا في التطوير المحلي؛ إنشاء السجل يتم من العميل بعد نجاح الرفع.
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.log("[v0] upload-recording token error:", (error as Error).message)
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
