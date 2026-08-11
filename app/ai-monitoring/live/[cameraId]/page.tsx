import { AppShell } from "@/components/app-shell"
import { requireHseReviewer } from "@/lib/session"
import { getCameraLiveStatus } from "@/app/actions/ai-monitoring"
import { LiveView } from "./live-view"

export const dynamic = "force-dynamic"

export default async function LiveCameraPage({
  params,
}: {
  params: Promise<{ cameraId: string }>
}) {
  const user = await requireHseReviewer()
  const { cameraId: raw } = await params
  const cameraId = decodeURIComponent(raw)

  // الحالة الأولية للعرض الفوري قبل بدء الاستقصاء من العميل.
  const initial = await getCameraLiveStatus(cameraId)

  return (
    <AppShell
      title={`مشاهدة مباشرة · ${cameraId}`}
      subtitle="بث فيديو حي مباشر (WebRTC) مع لقطات احتياطية ونتائج تحليل الذكاء الاصطناعي لحظياً"
      user={user}
    >
      <LiveView cameraId={cameraId} initial={initial} />
    </AppShell>
  )
}
