import { AppShell } from "@/components/app-shell"
import { requireModule } from "@/lib/session"
import { getServerT } from "@/lib/i18n/server"
import { getQrLabels } from "@/app/actions/equipment-checks"
import { QrLabelsClient } from "./qr-labels-client"

export default async function QrLabelsPage() {
  const user = await requireModule("equipment")
  const { t } = await getServerT()
  const labels = await getQrLabels()

  return (
    <AppShell title={t("equipQr.title")} subtitle={t("equipQr.subtitle")} user={user}>
      <QrLabelsClient labels={labels} />
    </AppShell>
  )
}
