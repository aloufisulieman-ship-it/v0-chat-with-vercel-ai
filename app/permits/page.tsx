import { FileSignature, CheckCircle2, Clock, ShieldAlert } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { PermitIssueWizard } from "@/components/permit-issue-wizard"
import { PermitsRegistry } from "@/components/permits-registry"
import { requireModule } from "@/lib/session"
import { isOrgManager } from "@/lib/session"
import { getPermitsFull, createPermitFull } from "@/app/actions/permit-workflow"
import { expireOverduePermits } from "@/app/actions/permit-workflow"
import { getServerT } from "@/lib/i18n/server"
import { normalizePermitStatus } from "@/lib/permit-workflow"

export default async function PermitsPage() {
  const user = await requireModule("permits")
  // تحديث كسول: عند فتح الصفحة نُنهي أي تصريح تجاوز وقته تلقائياً قبل العرض.
  await expireOverduePermits(user.organizationId)
  const permits = await getPermitsFull()
  const { t } = await getServerT()

  const isManager = user.isPlatformAdmin ? true : isOrgManager(user)

  const live = permits.filter((p) => !p.archivedAt)
  const active = live.filter((p) => normalizePermitStatus(p.status) === "active").length
  const pending = live.filter((p) => normalizePermitStatus(p.status) === "pending").length
  const expired = live.filter((p) => normalizePermitStatus(p.status) === "expired").length

  return (
    <AppShell
      title={t("pageHeaders.permitsTitle")}
      subtitle={t("pageHeaders.permitsSubtitle")}
      user={user}
      action={<PermitIssueWizard action={createPermitFull} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t("permits.totalPermits")} value={permits.length} icon={FileSignature} tone="blue" />
        <KpiCard label={t("permits.activePermits")} value={active} icon={Clock} tone="primary" />
        <KpiCard label={t("permits.pendingApproval")} value={pending} icon={CheckCircle2} tone="accent" />
        <KpiCard label={t("permitsReg.expiredKpi")} value={expired} icon={ShieldAlert} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("permits.registryTitle")}</h2>
        <PermitsRegistry permits={permits} isManager={isManager} />
      </div>
    </AppShell>
  )
}
