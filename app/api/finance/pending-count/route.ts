import { NextResponse } from "next/server"
import { getFinancePendingCount } from "@/app/actions/finance"

// عدد المخالفات الخارجية غير المعالجة، لشارة الإشعار في القائمة الجانبية.
export async function GET() {
  try {
    const count = await getFinancePendingCount()
    return NextResponse.json({ count })
  } catch {
    // المستخدم لا يملك صلاحية finance أو غير مسجّل — لا تُظهر شارة.
    return NextResponse.json({ count: 0 })
  }
}
