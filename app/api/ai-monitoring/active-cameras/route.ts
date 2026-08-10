import { NextResponse } from "next/server"
import { getActiveCameraStreams } from "@/app/actions/ai-monitoring"

// الكاميرات المتصلة حالياً للوحة المدير (يُستدعى دورياً عبر SWR كل بضع ثوانٍ).
export async function GET() {
  try {
    const rows = await getActiveCameraStreams()
    return NextResponse.json({ cameras: rows })
  } catch {
    return NextResponse.json({ cameras: [] }, { status: 200 })
  }
}
