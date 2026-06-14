import { NextResponse } from "next/server"
import { getHrPendingCount } from "@/app/actions/hr"

// عدد بنود الموارد البشرية غير المعالجة، لشارة الإشعار في القائمة الجانبية.
export async function GET() {
  try {
    const count = await getHrPendingCount()
    return NextResponse.json({ count })
  } catch {
    // المستخدم لا يملك صلاحية hr أو غير مسجّل — لا تُظهر شارة.
    return NextResponse.json({ count: 0 })
  }
}
