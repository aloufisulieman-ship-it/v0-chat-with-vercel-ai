import { redirect } from "next/navigation"

// دُمجت صفحة تتبع المركبات داخل صفحة المراقبة الذكية كتبويب. نُبقي هذا المسار كإعادة
// توجيه دائم حتى لا تنكسر أي روابط سابقة كانت تشير إلى /vehicle-tracking.
export default function VehicleTrackingRedirect() {
  redirect("/ai-monitoring?tab=vehicle-tracking")
}
