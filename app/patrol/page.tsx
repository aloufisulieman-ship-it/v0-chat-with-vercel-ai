import { AppShell } from "@/components/app-shell"
import { requireModule } from "@/lib/session"
import { PatrolClient } from "./patrol-client"

// صفحة الجولة التفتيشية: تسجيل سريع للمخالفات أثناء الجولة، ترتبط مباشرة بنظام
// المخالفات. الوصول مقيّد بصلاحية وحدة المخالفات.
export default async function PatrolPage() {
  const user = await requireModule("violations")

  return (
    <AppShell
      title="الجولة التفتيشية"
      subtitle="سجّل المخالفات أثناء الجولة لترسَل تلقائياً إلى سجل المخالفات الرسمي"
      user={user}
    >
      <PatrolClient />
    </AppShell>
  )
}
