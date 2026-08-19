import { AppShell } from "@/components/app-shell"
import { requireHseReviewer } from "@/lib/session"
import { getActiveCameraStreams } from "@/app/actions/ai-monitoring"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { GridView } from "./grid-view"
import type { CameraStreamDto } from "../connected-cameras"

export const dynamic = "force-dynamic"

export default async function CameraGridPage() {
  const user = await requireHseReviewer()
  const rows = await getActiveCameraStreams()

  // تحويل التواريخ إلى نصوص لتتوافق مع بيانات الـ API أثناء التحديث الحي.
  const initial: CameraStreamDto[] = rows.map((r) => ({
    id: r.id,
    cameraId: r.cameraId,
    inspectorName: r.inspectorName ?? "",
    cameraLocation: r.cameraLocation ?? "",
    lastFrameUrl: r.lastFrameUrl ?? "",
    lastSeenAt: (r.lastSeenAt as unknown as Date)?.toISOString?.() ?? String(r.lastSeenAt),
  }))

  return (
    <AppShell
      title="جدار الكاميرات المباشر"
      subtitle="عرض جميع الكاميرات النشطة في آنٍ واحد على شاشة واحدة"
      user={user}
      action={
        <Link
          href="/ai-monitoring"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <ArrowRight className="size-4" />
          العودة للوحة المراقبة
        </Link>
      }
    >
      <GridView initial={initial} />
    </AppShell>
  )
}
