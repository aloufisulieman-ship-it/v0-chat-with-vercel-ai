import { AppShell } from "@/components/app-shell"
import { requireHseReviewer } from "@/lib/session"
import { getRecordingsPage } from "@/app/actions/recordings"
import { RecordingsReview } from "./recordings-review"
import { getServerT } from "@/lib/i18n/server"

export const dynamic = "force-dynamic"

export default async function RecordingsPage() {
  const user = await requireHseReviewer()
  const initialPage = await getRecordingsPage({ page: 1, pageSize: 12 })
  const { t } = await getServerT()

  return (
    <AppShell
      title={t("pageHeaders.recordingsTitle")}
      subtitle={t("pageHeaders.recordingsSubtitle")}
      user={user}
    >
      <RecordingsReview initialPage={initialPage} />
    </AppShell>
  )
}
