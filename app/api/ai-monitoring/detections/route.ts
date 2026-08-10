import { NextResponse } from "next/server"
import { getDetections } from "@/app/actions/ai-monitoring"

// بث الاكتشافات للوحة المراقبة (يُستدعى دورياً عبر SWR).
export async function GET() {
  try {
    const rows = await getDetections()
    return NextResponse.json({ detections: rows })
  } catch {
    return NextResponse.json({ detections: [] }, { status: 200 })
  }
}
