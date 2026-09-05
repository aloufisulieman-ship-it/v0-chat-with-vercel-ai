"use client"

import { useMemo, useState } from "react"
import { DataTable, type Column } from "@/components/data-table"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { RiskMatrix, type MatrixCell } from "@/components/risk-matrix"
import { RiskLifecycleActions } from "@/components/risk-lifecycle-actions"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"
import { getRiskBand, riskLevel, RISK_BANDS, type RiskBandId } from "@/lib/labels"
import { normalizeRiskStatus, riskStatusLabel, riskStatusBadgeClass } from "@/lib/risk-lifecycle"
import type { getRisks, deleteRisk as deleteRiskAction } from "@/app/actions/hse"

const LEGEND_KEY: Record<RiskBandId, string> = {
  low: "riskMatrix.legendLow",
  medium: "riskMatrix.legendMedium",
  high: "riskMatrix.legendHigh",
  critical: "riskMatrix.legendCritical",
}
const ACTION_KEY: Record<RiskBandId, string> = {
  low: "riskMatrix.actionLow",
  medium: "riskMatrix.actionMedium",
  high: "riskMatrix.actionHigh",
  critical: "riskMatrix.actionCritical",
}

// نستمد النوع من الإجراء الخادمي مباشرةً كي لا ينحرف عن مخطط قاعدة البيانات.
export type RiskRow = Awaited<ReturnType<typeof getRisks>>[number]

// شارة مستوى المخاطرة — تستمد لونها من getRiskBand فقط (لا ألوان ثابتة).
function RiskBadge({ score }: { score: number }) {
  const { t } = useI18n()
  const band = getRiskBand(score)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        band.badge,
      )}
    >
      {t(LEGEND_KEY[band.id])}
    </span>
  )
}

export function RiskAssessmentView({
  risks,
  deleteRisk,
  actionCounts = {},
  isManager = false,
}: {
  risks: RiskRow[]
  deleteRisk: typeof deleteRiskAction
  actionCounts?: Record<number, { total: number; completed: number }>
  isManager?: boolean
}) {
  const { t, locale } = useI18n()
  const loc = locale === "en" ? "en" : "ar"
  const [selected, setSelected] = useState<MatrixCell | null>(null)

  // تُرتَّب تنازلياً حسب درجة المخاطرة فتظهر الحرجة في الأعلى.
  const scored = useMemo(
    () =>
      risks
        .map((r) => ({ ...r, score: (r.likelihood ?? 1) * (r.consequence ?? 1) }))
        .sort((a, b) => b.score - a.score),
    [risks],
  )

  const filtered = useMemo(
    () =>
      selected
        ? scored.filter(
            (r) => (r.likelihood ?? 1) === selected.likelihood && (r.consequence ?? 1) === selected.consequence,
          )
        : scored,
    [scored, selected],
  )

  const columns: Column<(typeof scored)[number]>[] = [
    { key: "hazard", header: t("risksMod.fHazard"), render: (r) => <span className="font-medium text-foreground">{r.hazard}</span> },
    { key: "activity", header: t("risksMod.fActivity"), render: (r) => <span className="text-muted-foreground">{r.activity || "-"}</span> },
    { key: "score", header: t("risksMod.fScore"), render: (r) => <span className="font-mono text-sm font-semibold text-foreground tabular-nums">{r.score}</span> },
    { key: "level", header: t("risksMod.fLevel"), render: (r) => <RiskBadge score={r.score} /> },
    { key: "controls", header: t("risksMod.fControls"), render: (r) => <span className="text-muted-foreground">{r.controls || "-"}</span> },
    { key: "owner", header: t("risksMod.fOwner"), render: (r) => <span className="text-muted-foreground">{r.owner || "-"}</span> },
    { key: "reviewDate", header: t("risksMod.fReviewDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground tabular-nums" dir="ltr">{r.reviewDate || "-"}</span> },
    {
      key: "status",
      header: t("risksMod.fStatus"),
      render: (r) => {
        const s = normalizeRiskStatus(r.status)
        return (
          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", riskStatusBadgeClass(s))}>
            {riskStatusLabel(s, loc)}
          </span>
        )
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RiskLifecycleActions risk={r} counts={actionCounts[r.id]} isManager={isManager} />
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
              { label: t("risksMod.fLevel"), value: t(LEGEND_KEY[riskLevel(r.score).value]) },
              { label: t("risksMod.fOwner"), value: r.owner || "-" },
              { label: t("risksMod.fReviewDate"), value: r.reviewDate || "-" },
              { label: t("risksMod.fStatus"), value: riskStatusLabel(normalizeRiskStatus(r.status), loc) },
            ]}
            extraSection={<ControlsTab risk={r} />}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteRisk} />
        </div>
      ),
    },
  ]

  const selectedValue = selected ? selected.likelihood * selected.consequence : null

  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RiskMatrix risks={risks} selected={selected} onSelect={setSelected} />

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-2 text-base font-semibold text-foreground">{t("risksMod.methodologyTitle")}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("risksMod.methodologyBody")}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {RISK_BANDS.map((band) => (
              <li key={band.id} className="flex items-start gap-2.5 text-sm">
                <span className={cn("mt-1 size-3 shrink-0 rounded", band.swatch)} />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{t(LEGEND_KEY[band.id])}</span>{" "}
                  <span className="font-mono text-xs tabular-nums" dir="ltr">
                    ({band.min}–{band.max})
                  </span>
                  {" — "}
                  {t(ACTION_KEY[band.id])}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            {t("risksMod.methodologyIso")}
          </p>
        </div>
      </div>

      <div className="mt-6" id="risk-registry">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">{t("risksMod.registryTitle")}</h2>
          {selected && (
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {t("riskMatrix.filteredBy")}
              <span className="font-mono tabular-nums text-foreground" dir="ltr">
                {selected.likelihood}×{selected.consequence}={selectedValue}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {t("riskMatrix.clearFilter")}
              </button>
            </span>
          )}
        </div>
        <DataTable columns={columns} rows={filtered} emptyMessage={t("risksMod.emptyMessage")} />
      </div>
    </>
  )
}

// تبويب الضوابط داخل نافذة التفاصيل: الحالية | المقترحة | المنفّذة.
function ControlsTab({ risk }: { risk: RiskRow }) {
  const { t } = useI18n()
  const cols: { key: string; title: string; value: string | null | undefined }[] = [
    { key: "existing", title: t("risksMod.controlsExisting"), value: risk.controls },
    { key: "proposed", title: t("risksMod.controlsProposed"), value: risk.proposedControls },
    { key: "implemented", title: t("risksMod.controlsImplemented"), value: risk.implementedControls },
  ]
  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-foreground">{t("risksMod.controlsTab")}</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        {cols.map((c) => (
          <div key={c.key} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
            <span className="text-xs font-medium text-muted-foreground">{c.title}</span>
            {c.value ? (
              <ul className="flex flex-col gap-1">
                {c.value
                  .split("•")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((line, i) => (
                    <li key={i} className="text-sm leading-relaxed text-foreground">
                      {line}
                    </li>
                  ))}
              </ul>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        ))}
      </div>
      {risk.closedBy && (
        <p className="text-xs text-muted-foreground">
          {t("risksMod.closedBy")}: <span className="font-medium text-foreground">{risk.closedBy}</span>
        </p>
      )}
    </section>
  )
}
