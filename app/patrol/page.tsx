import { requireModule } from "@/lib/session"
import { getOperationalSettings } from "@/app/actions/org-settings"
import { PatrolClient } from "./patrol-client"

// صفحة الجولة الميدانية: واجهة كاملة الشاشة لتسجيل المخالفات/الملاحظات/الإيجابيات
// أثناء الجولة، والمخالفات تُحفظ تلقائياً في سجل المخالفات الرسمي عبر /api/patrol-violation.
// الوصول مقيّد بصلاحية وحدة المخالفات.
export default async function PatrolPage() {
  await requireModule("violations")
  const operational = await getOperationalSettings()
  // تخصيص فئات الجولة (label/icon/color) بالترتيب فوق الفئات المدمجة.
  const categoryOverrides = operational.inspectionCategories.map((c) => ({
    label: c.label,
    icon: c.icon,
    color: c.color,
  }))
  return <PatrolClient categoryOverrides={categoryOverrides} />
}
