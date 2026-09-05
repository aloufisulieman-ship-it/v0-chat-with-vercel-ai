import { ShieldAlert, Flame, Gauge, Layers } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RiskAssessmentView } from "@/components/risk-assessment-view"
import { requireModule } from "@/lib/session"
import { getRisks, createRisk, deleteRisk } from "@/app/actions/hse"
import { statusOptions } from "@/lib/labels"
import { getServerT } from "@/lib/i18n/server"
import { statusLabel } from "@/lib/i18n/labels"


const scoreOptions = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))

export default async function RisksPage() {
  const user = await requireModule("risks")
  const risks = await getRisks()
  const { t } = await getServerT()

  const fields: FieldDef[] = [
    { name: "hazard", label: t("risksMod.fHazard"), required: true, full: true, placeholder: t("risksMod.fHazardPlaceholder") },
    { name: "activity", label: t("risksMod.fActivity"), placeholder: t("risksMod.fActivityPlaceholder") },
    { name: "owner", label: t("risksMod.fOwner") },
    { name: "likelihood", label: t("risksMod.fLikelihood"), type: "select", options: scoreOptions },
    { name: "consequence", label: t("risksMod.fConsequence"), type: "select", options: scoreOptions },
    { name: "reviewDate", label: t("risksMod.fReviewDate"), type: "date" },
    { name: "status", label: t("risksMod.fStatus"), type: "select", options: statusOptions.map((o) => ({ value: o.value, label: statusLabel(t, o.value) })) },
    { name: "controls", label: t("risksMod.fControls"), type: "textarea" },
    { name: "proposedControls", label: t("risksMod.fProposedControls"), type: "textarea" },
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("risksMod.kpiTotal")} value={risks.length} icon={Layers} tone="blue" />
        <KpiCard label={t("risksMod.avgScore")} value={avgScore} icon={Gauge} tone="primary" />
        <KpiCard label={t("risksMod.kpiHighCriticalPct")} value={`${highCriticalPct}%`} icon={Flame} tone="destructive" />
        <KpiCard label={t("risksMod.kpiNoControls")} value={noControls} icon={ShieldAlert} tone="accent" />
      </div>

      <RiskAssessmentView risks={risks} deleteRisk={deleteRisk} />
    </AppShell>
  )
}
