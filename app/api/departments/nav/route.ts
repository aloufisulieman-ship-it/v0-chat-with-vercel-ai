import { NextResponse } from "next/server"
import { getDepartmentsNav } from "@/app/actions/referrals"

// بيانات قسم «الأقسام» للقائمة الجانبية (أقسام مرئية + عدّادات + مجموع المتأخرات).
export async function GET() {
  try {
    return NextResponse.json(await getDepartmentsNav())
  } catch {
    // غير مسجّل أو خطأ — لا تُظهر القسم في القائمة.
    return NextResponse.json({
      visible: false,
      mode: "none",
      canSeeOverview: false,
      overdueTotal: 0,
      departments: [],
    })
  }
}
