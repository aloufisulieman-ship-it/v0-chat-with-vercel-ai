import { AppShell } from "@/components/app-shell"
import { requireModule } from "@/lib/session"
import { getServerT } from "@/lib/i18n/server"
import { getRecentChecksDetailed, getComplianceToday } from "@/app/actions/equipment-checks"
import { ChecksClient } from "./checks-client"

export default async function EquipmentChecksPage() {
  const user = await requireModule("equipment")
  const { t } = await getServerT()
  const [checks, compliance] = await Promise.all([getRecentChecksDetailed(200), getComplianceToday()])

  return (
    <AppShell title={t("equipChecks.title")} subtitle={t("equipChecks.subtitle")} user={user}>
      <ChecksClient checks={checks} compliance={compliance} />
    </AppShell>
  )
}
