import { redirect } from "next/navigation"

// وحدة الموارد البشرية اندمجت في مركز الأقسام. نعيد التوجيه إلى قسم HR حفاظاً على الروابط القديمة.
export default function HrPage() {
  redirect("/departments/HR")
}
