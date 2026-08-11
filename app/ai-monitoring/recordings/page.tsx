import { AppShell } from "@/components/app-shell"
import { requireHseReviewer } from "@/lib/session"
import { getRecordings } from "@/app/actions/recordings"
import { RecordingsReview } from "./recordings-review"

export const dynamic = "force-dynamic"

export default async function RecordingsPage() {
  const user = await requireHseReviewer()
  const recordings = await getRecordings()

  return (
    <AppShell
      title="تسجيلات الفيديو"
      subtitle="مراجعة تسجيلات كاميرات الهاتف، التقاط لقطات، وإنشاء مخالفات منها"
      user={user}
    >
      <RecordingsReview initialRecordings={recordings} />
    </AppShell>
  )
}
