import { AppShell } from "@/components/app-shell"
import { requireModule } from "@/lib/session"
import { getDetections } from "@/app/actions/ai-monitoring"
import { getTrackingOverview, getVehiclesInside } from "@/app/actions/vehicle-tracking"
import { MonitoringDashboard, type DetectionDto } from "./monitoring-dashboard"
import { getServerT } from "@/lib/i18n/server"
import Link from "next/link"
import { Smartphone, Video, LayoutGrid } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AiMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await requireModule("ai_monitoring")
  const rows = await getDetections()
  // بيانات نظام تتبع المركبات الكامل لعرضها داخل تبويب "تتبع المركبات".
  const [trackingOverview, trackingInside] = await Promise.all([getTrackingOverview(), getVehiclesInside()])
  const { t } = await getServerT()
  // التبويب الابتدائي مدفوع بالرابط: /ai-monitoring?tab=vehicle-tracking يفتح تبويب المركبات.
  const sp = await searchParams
  const initialTab = sp?.tab === "vehicle-tracking" ? "vehicles" : "live"

  // تحويل التواريخ إلى نصوص لتتوافق مع بيانات الـ API أثناء التحديث الحي.
  const initial: DetectionDto[] = rows.map((r) => ({
    id: r.id,
    detectionId: r.detectionId,
    cameraId: r.cameraId,
    inspectorName: r.inspectorName ?? "",
    cameraLocation: r.cameraLocation,
    detectionType: r.detectionType,
    // كل أنواع المخالفات المرصودة في نفس اللقطة (تُعرض كقائمة داخل البند الواحد).
    detectionTypes: r.detectionTypes,
    severity: r.severity,
    confidenceScore: r.confidenceScore,
    // اللقطة تُجلب عند الطلب؛ نمرّر فقط علامة التوفّر لعرض زر «لقطة».
    hasSnapshot: r.hasSnapshot,
    detectedAt: (r.detectedAt as unknown as Date)?.toISOString?.() ?? String(r.detectedAt),
    detectionCount: r.detectionCount ?? 1,
    lastDetectedAt: (r.lastDetectedAt as unknown as Date)?.toISOString?.() ?? String(r.lastDetectedAt),
    status: r.status,
    acknowledgedBy: r.acknowledgedBy ?? "",
    resolvedBy: r.resolvedBy ?? "",
    notes: r.notes ?? "",
    linkedViolationNo: r.linkedViolationNo ?? "",
  }))

  return (
    <AppShell
      title={t("pageHeaders.aiMonitoringTitle")}
      subtitle={t("pageHeaders.aiMonitoringSubtitle")}
      user={user}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/ai-monitoring/grid"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <LayoutGrid className="size-4" />
            {t("aiMonitoring.displayWall")}
          </Link>
          <Link
            href="/ai-monitoring/recordings"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Video className="size-4" />
            {t("aiMonitoring.recordings")}
          </Link>
          <Link
            href="/ai-monitoring/mobile-camera"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Smartphone className="size-4" />
            {t("aiMonitoring.phoneStream")}
          </Link>
        </div>
      }
    >
      <MonitoringDashboard
        initial={initial}
        isAdmin={user.role === "admin"}
        trackingOverview={trackingOverview}
        trackingInside={trackingInside}
        initialTab={initialTab}
      />
    </AppShell>
  )
}
