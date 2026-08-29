import { NextResponse } from "next/server"
import { getTrackingOverview, getVehiclesInside } from "@/app/actions/vehicle-tracking"

export async function GET() {
  try {
    const [overview, inside] = await Promise.all([getTrackingOverview(), getVehiclesInside()])
    return NextResponse.json({ overview, inside })
  } catch {
    return NextResponse.json({ overview: { inside: 0, outside: 0, blocked: 0, total: 0 }, inside: [] })
  }
}
