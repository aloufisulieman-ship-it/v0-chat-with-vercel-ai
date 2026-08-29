import { AppShell } from "@/components/app-shell"
import { requireModule } from "@/lib/session"
import { getCameraLiveStatus } from "@/app/actions/ai-monitoring"
import { LiveView } from "./live-view"
import { getServerT } from "@/lib/i18n/server"

export const dynamic = "force-dynamic"

export default async function LiveCameraPage({
  params,
}: {
  params: Promise<{ cameraId: string }>
}) {
  const user = await requireModule("ai_monitoring")
  const { cameraId: raw } = await params
  const cameraId = decodeURIComponent(raw)
  const { t } = await getServerT()

  // الحالة الأولية للعرض الفوري قبل بدء الاستقصاء من العميل.
  const initial = await getCameraLiveStatus(cameraId)

  return (
    <AppShell
      title={`${t("aiMonitoring.cam.liveTitlePrefix")} · ${cameraId}`}
      subtitle={t("pageHeaders.liveSubtitle")}
      user={user}
    >
      <LiveView cameraId={cameraId} initial={initial} serverNow={Date.now()} />
    </AppShell>
  )
}
