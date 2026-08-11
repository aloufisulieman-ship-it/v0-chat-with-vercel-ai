import { type NextRequest, NextResponse } from "next/server"
import { getCameraLiveStatus } from "@/app/actions/ai-monitoring"

// حالة كاميرا واحدة للعرض شبه الحي (يُستدعى دورياً كل 1-2 ثانية عبر SWR).
export async function GET(req: NextRequest) {
  try {
    const cameraId = req.nextUrl.searchParams.get("cameraId") || ""
    if (!cameraId) {
      return NextResponse.json({ camera: null, latestDetection: null }, { status: 400 })
    }
    const status = await getCameraLiveStatus(cameraId)
    return NextResponse.json(status)
  } catch {
    return NextResponse.json({ camera: null, latestDetection: null }, { status: 200 })
  }
}
