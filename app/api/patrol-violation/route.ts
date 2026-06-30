import { NextResponse } from "next/server"
import { createViolationFull } from "@/app/actions/hse"
import { classifyViolation } from "@/lib/violation-category"

// نقطة ربط الجولة بنظام المخالفات: تستقبل بيانات المخالفة المسجّلة أثناء الجولة
// كـ JSON، وتبنيها كـ FormData ثم تمررها لنفس الدالة التي يستخدمها نموذج
// المخالفات (createViolationFull) — فتظهر المخالفة فوراً في صفحة /violations
// وتحصل على رقمها الرسمي VIO-YYYY-XXX.
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const employeeName = String(body.employeeName ?? "").trim()
    if (!employeeName) {
      return NextResponse.json({ error: "اسم الموظف مطلوب" }, { status: 400 })
    }

    const violationType = String(body.violationType ?? "").trim()

    const fd = new FormData()
    fd.set("employeeName", employeeName)
    fd.set("employeeNo", String(body.employeeNo ?? ""))
    fd.set("nationality", String(body.nationality ?? ""))
    fd.set("companyName", String(body.companyName ?? ""))
    fd.set("violationType", violationType)
    // التصنيف التلقائي بنفس منطق نموذج المخالفات إن لم يُمرَّر صراحةً.
    fd.set("category", String(body.category || classifyViolation(violationType)))
    fd.set("internalAction", String(body.internalAction ?? ""))
    fd.set("violationDate", String(body.violationDate ?? ""))
    fd.set("violationTime", String(body.violationTime ?? ""))
    fd.set("place", String(body.place ?? ""))
    fd.set("description", String(body.description ?? ""))
    fd.set("witnesses", String(body.witnesses ?? ""))
    fd.set("proposedAction", String(body.proposedAction ?? ""))
    fd.set("status", String(body.status || "open"))
    // صور الأدلة (اختيارية) كمصفوفة base64.
    fd.set("images", JSON.stringify(Array.isArray(body.images) ? body.images : []))

    const result = await createViolationFull(fd)
    return NextResponse.json({ documentNo: result.documentNo })
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذّر حفظ المخالفة"
    // خطأ الصلاحيات يُرجِع 403، وأي خطأ آخر 500.
    const status = message.includes("صلاحية") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
