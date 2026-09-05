import { ShieldAlert, Flame, Gauge, Layers, BellRing } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RiskAssessmentView } from "@/components/risk-assessment-view"
import { requireModule, isOrgManager } from "@/lib/session"
import { getRisks, createRisk, deleteRisk } from "@/app/actions/hse"
import { getRiskActionCounts, getRiskVerificationNotifications } from "@/app/actions/risk-lifecycle"
import { getServerT } from "@/lib/i18n/server"


const scoreOptions = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))

export default async function RisksPage() {
  const user = await requireModule("risks")
  const [risks, actionCounts, notifications] = await Promise.all([
    getRisks(),
    getRiskActionCounts(),
    getRiskVerificationNotifications(),
  ])
  const isManager = isOrgManager(user)
  const { t } = await getServerT()

  const fields: FieldDef[] = [
    { name: "hazard", label: t("risksMod.fHazard"), required: true, full: true, placeholder: t("risksMod.fHazardPlaceholder") },
    { name: "activity", label: t("risksMod.fActivity"), placeholder: t("risksMod.fActivityPlaceholder") },
    { name: "owner", label: t("risksMod.fOwner") },
    { name: "likelihood", label: t("risksMod.fLikelihood"), type: "select", options: scoreOptions },
    { name: "consequence", label: t("risksMod.fConsequence"), type: "select", options: scoreOptions },
    { name: "reviewDate", label: t("risksMod.fReviewDate"), type: "date" },
    { name: "controls", label: t("risksMod.controlsExisting"), type: "textarea", full: true },
  ]

  // نطاقات ISO 45001: منخفض 1–4، متوسط 5–9، عالٍ 10–15، حرج 16–25.
  const scored = risks.map((r) => ({ ...r, score: (r.likelihood ?? 1) * (r.consequence ?? 1) }))
  const critical = scored.filter((r) => r.score >= 16).length
  const high = scored.filter((r) => r.score >= 10 && r.score <= 15).length
  const avgScore = scored.length ? Math.round(scored.reduce((a, b) => a + b.score, 0) / scored.length) : 0
  const highCriticalPct = scored.length ? Math.round(((critical + high) / scored.length) * 100) : 0
  const noControls = risks.filter((r) => !r.controls || r.controls.trim() === "").length

  return (
    <AppShell
      title={t("pageHeaders.risksTitle")}
      subtitle={t("pageHeaders.risksSubtitle")}
      user={user}
      action={<RecordDialog title={t("risksMod.dialogTitle")} description={t("risksMod.dialogDesc")} triggerLabel={t("risksMod.trigger")} fields={fields} action={createRisk} />}
    >
      {isManager && notifications.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <BellRing className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-foreground">
              {t("risksMod.verificationBannerTitle")} ({notifications.length})
            </span>
            <ul className="flex flex-col gap-0.5">
              {notifications.slice(0, 4).map((n) => (
                <li key={n.id} className="text-sm text-muted-foreground">
                  {n.title}
                </li>
              ))}
            </ul>
            <a href="#risk-registry" className="mt-1 text-sm font-medium text-primary underline-offset-2 hover:underline">
              {t("risksMod.verificationBannerCta")}
            </a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("risksMod.kpiTotal")} value={risks.length} icon={Layers} tone="blue" />
        <KpiCard label={t("risksMod.avgScore")} value={avgScore} icon={Gauge} tone="primary" />
        <KpiCard label={t("risksMod.kpiHighCriticalPct")} value={`${highCriticalPct}%`} icon={Flame} tone="destructive" />
        <KpiCard label={t("risksMod.kpiNoControls")} value={noControls} icon={ShieldAlert} tone="accent" />
      </div>

      <RiskAssessmentView risks={risks} deleteRisk={deleteRisk} actionCounts={actionCounts} isManager={isManager} />
    </AppShell>
  )
}
