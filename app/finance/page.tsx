import { redirect } from "next/navigation"

// وحدة المالية اندمجت في مركز الأقسام. نعيد التوجيه إلى قسم FIN حفاظاً على الروابط القديمة.
export default function FinancePage() {
  redirect("/departments/FIN")
}
