import { getSafetyRules } from "@/app/actions/equipment"
import { AppShell } from "@/components/app-shell"
import { requireModule } from "@/lib/session"
import { SafetyRulesRegistry } from "@/app/safety-rules/safety-rules-registry"
import { getServerT } from "@/lib/i18n/server"

export default async function SafetyRulesPage() {
  const user = await requireModule("ai_monitoring")
  const items = await getSafetyRules()
  const { t } = await getServerT()

  return (
    <AppShell title={t("pageHeaders.safetyRulesTitle")} subtitle={t("pageHeaders.safetyRulesSubtitle")} user={user}>
      <SafetyRulesRegistry items={items} />
    </AppShell>
  )
}
