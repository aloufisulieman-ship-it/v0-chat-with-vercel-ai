import { NextResponse } from "next/server"
import { getActiveCameraStreams } from "@/app/actions/ai-monitoring"

// شاشة مراقبة حية: يجب ألا يُخزَّن هذا المسار مؤقتاً إطلاقاً حتى يعكس كل جلب
// أحدث حالة للكاميرات (لحظة آخر إطار). بدون ذلك يُعيد Next.js استجابة مخزّنة.
export const dynamic = "force-dynamic"
export const revalidate = 0

// الكاميرات المتصلة حالياً للوحة المدير (يُستدعى دورياً عبر SWR كل بضع ثوانٍ).
export async function GET() {
  try {
    const rows = await getActiveCameraStreams()
    return NextResponse.json({ cameras: rows })
  } catch {
    return NextResponse.json({ cameras: [] }, { status: 200 })
  }
}
