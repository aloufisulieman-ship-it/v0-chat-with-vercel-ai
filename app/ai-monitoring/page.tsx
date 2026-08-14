import { AppShell } from "@/components/app-shell"
import { requireHseReviewer } from "@/lib/session"
import { getDetections } from "@/app/actions/ai-monitoring"
import { MonitoringDashboard, type DetectionDto } from "./monitoring-dashboard"
import Link from "next/link"
import { Smartphone, Video, LayoutGrid } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AiMonitoringPage() {
  const user = await requireHseReviewer()
  const rows = await getDetections()

  // تحويل التواريخ إلى نصوص لتتوافق مع بيانات الـ API أثناء التحديث الحي.
  const initial: DetectionDto[] = rows.map((r) => ({
    id: r.id,
    detectionId: r.detectionId,
    cameraId: r.cameraId,
    inspectorName: r.inspectorName ?? "",
    cameraLocation: r.cameraLocation,
    detectionType: r.detectionType,
    severity: r.severity,
    confidenceScore: r.confidenceScore,
    snapshotUrl: r.snapshotUrl,
    detectedAt: (r.detectedAt as unknown as Date)?.toISOString?.() ?? String(r.detectedAt),
    status: r.status,
    acknowledgedBy: r.acknowledgedBy ?? "",
    resolvedBy: r.resolvedBy ?? "",
    notes: r.notes ?? "",
  }))

  return (
    <AppShell
      title="المراقبة الذكية بالذكاء الاصطناعي"
      subtitle="رصد مخالفات السلامة لحظياً في ساحات الرافعات الشوكية عبر تحليل بث الكاميرات"
      user={user}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/ai-monitoring/grid"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <LayoutGrid className="size-4" />
            جدار العرض
          </Link>
          <Link
            href="/ai-monitoring/recordings"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Video className="size-4" />
            التسجيلات
          </Link>
          <Link
            href="/ai-monitoring/mobile-camera"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Smartphone className="size-4" />
            بث كاميرا الهاتف
          </Link>
        </div>
      }
    >
      <MonitoringDashboard initial={initial} isAdmin={user.role === "admin"} />
    </AppShell>
  )
}
