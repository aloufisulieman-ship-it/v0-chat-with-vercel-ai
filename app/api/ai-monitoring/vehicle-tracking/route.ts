import { NextResponse } from "next/server"
import { getVehicleTracking } from "@/app/actions/ai-monitoring"

// بث تتبّع المركبات للوحة المراقبة (يُستدعى دورياً عبر SWR).
export async function GET() {
  try {
    const vehicles = await getVehicleTracking()
    return NextResponse.json({ vehicles })
  } catch {
    return NextResponse.json({ vehicles: [] }, { status: 200 })
  }
}
