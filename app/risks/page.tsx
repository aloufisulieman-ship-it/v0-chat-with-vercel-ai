import { ShieldAlert, Flame, ShieldCheck, Layers } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge, SeverityBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { RiskMatrix } from "@/components/risk-matrix"
import { requireModule } from "@/lib/session"
import { getRisks, createRisk, deleteRisk } from "@/app/actions/hse"
import { statusOptions, riskLevel } from "@/lib/labels"
import { getServerT } from "@/lib/i18n/server"
import { statusLabel, severityLabel } from "@/lib/i18n/labels"

type RiskItem = Awaited<ReturnType<typeof getRisks>>[number]

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
    { name: "status", label: t("risksMod.fStatus"), type: "select", options: statusOptions.map((o) => ({ value: o.value, label: statusLabel(t, o.value) })) },
    { name: "controls", label: t("risksMod.fControls"), type: "textarea" },
  ]

  const scored = risks.map((r) => ({ ...r, score: (r.likelihood ?? 1) * (r.consequence ?? 1) }))
  const critical = scored.filter((r) => r.score >= 15).length
  const high = scored.filter((r) => r.score >= 9 && r.score < 15).length
  const controlled = risks.filter((r) => r.status === "closed").length
  const avgScore = scored.length ? Math.round(scored.reduce((a, b) => a + b.score, 0) / scored.length) : 0

  const columns: Column<(typeof scored)[number]>[] = [
    { key: "hazard", header: t("risksMod.fHazard"), render: (r) => <span className="font-medium text-foreground">{r.hazard}</span> },
    { key: "activity", header: t("risksMod.fActivity"), render: (r) => <span className="text-muted-foreground">{r.activity || "-"}</span> },
    { key: "score", header: t("risksMod.fScore"), render: (r) => <span className="font-mono text-sm font-semibold text-foreground">{r.score}</span> },
    { key: "level", header: t("risksMod.fLevel"), render: (r) => <SeverityBadge severity={riskLevel(r.score).value} /> },
    { key: "controls", header: t("risksMod.fControls"), render: (r) => <span className="text-muted-foreground">{r.controls || "-"}</span> },
    { key: "owner", header: t("risksMod.fOwner"), render: (r) => <span className="text-muted-foreground">{r.owner || "-"}</span> },
    { key: "status", header: t("risksMod.fStatus"), render: (r) => <StatusBadge status={r.status ?? "open"} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="risks"
            recordId={r.id}
            title={r.hazard}
            subtitle={t("risksMod.detailsSubtitle")}
            fields={[
              { label: t("risksMod.fHazard"), value: r.hazard },
              { label: t("risksMod.fActivity"), value: r.activity || "-" },
              { label: t("risksMod.fLikelihoodShort"), value: String(r.likelihood ?? 1) },
              { label: t("risksMod.fConsequenceShort"), value: String(r.consequence ?? 1) },
              { label: t("risksMod.fScoreDetail"), value: String(r.score) },
              { label: t("risksMod.fLevel"), value: severityLabel(t, riskLevel(r.score).value) },
              { label: t("risksMod.fControls"), value: r.controls || "-" },
              { label: t("risksMod.fOwner"), value: r.owner || "-" },
              { label: t("risksMod.fStatus"), value: r.status ? statusLabel(t, r.status) : "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteRisk} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.risksTitle")}
      subtitle={t("pageHeaders.risksSubtitle")}
      user={user}
      action={<RecordDialog title={t("risksMod.dialogTitle")} description={t("risksMod.dialogDesc")} triggerLabel={t("risksMod.trigger")} fields={fields} action={createRisk} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("risksMod.kpiTotal")} value={risks.length} icon={Layers} tone="blue" />
        <KpiCard label={t("risksMod.kpiCritical")} value={critical} icon={Flame} tone="destructive" />
        <KpiCard label={t("risksMod.kpiHigh")} value={high} icon={ShieldAlert} tone="accent" />
        <KpiCard label={t("risksMod.kpiControlled")} value={controlled} icon={ShieldCheck} tone="primary" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RiskMatrix risks={risks} />
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-base font-semibold text-foreground">{t("risksMod.methodologyTitle")}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("risksMod.methodologyBody")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{avgScore}</p>
              <p className="text-xs text-muted-foreground">{t("risksMod.avgScore")}</p>
            </div>
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{risks.length ? Math.round((controlled / risks.length) * 100) : 0}%</p>
              <p className="text-xs text-muted-foreground">{t("risksMod.treatedPct")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("risksMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={scored} emptyMessage={t("risksMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
