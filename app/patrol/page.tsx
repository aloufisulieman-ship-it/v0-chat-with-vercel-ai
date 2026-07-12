import { requireModule } from "@/lib/session"
import { PatrolClient } from "./patrol-client"

// صفحة الجولة الميدانية: واجهة كاملة الشاشة لتسجيل المخالفات/الملاحظات/الإيجابيات
// أثناء الجولة، والمخالفات تُحفظ تلقائياً في سجل المخالفات الرسمي عبر /api/patrol-violation.
// الوصول مقيّد بصلاحية وحدة المخالفات.
export default async function PatrolPage() {
  await requireModule("violations")
  return <PatrolClient />
}
