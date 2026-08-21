import { NextResponse } from "next/server"
import { getDetectionSnapshot } from "@/app/actions/ai-monitoring"

// لقطة إثبات اكتشاف واحد عند الطلب (لتفادي إرسال آلاف الكيلوبايت من base64 مع كل
// دورة تحديث للجدول). تُستدعى فقط عند فتح نافذة «لقطة».
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const detectionId = Number.parseInt(id, 10)
    if (!Number.isFinite(detectionId)) {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 })
    }
    const snapshotUrl = await getDetectionSnapshot(detectionId)
    return NextResponse.json({ snapshotUrl })
  } catch {
    return NextResponse.json({ error: "تعذّر جلب اللقطة" }, { status: 500 })
  }
}
