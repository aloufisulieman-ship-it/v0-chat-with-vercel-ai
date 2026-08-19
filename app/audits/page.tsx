import { ClipboardList, BadgeCheck, FileWarning, Gauge } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getAudits, createAudit, deleteAudit } from "@/app/actions/hse"
import { inspectionStatusOptions } from "@/lib/labels"
import { getServerT } from "@/lib/i18n/server"
import { statusLabel } from "@/lib/i18n/labels"
import { cn } from "@/lib/utils"

type AuditItem = Awaited<ReturnType<typeof getAudits>>[number]

function ScoreBar({ score }: { score: number }) {
  const tone = score >= 90 ? "bg-primary" : score >= 80 ? "bg-accent" : "bg-destructive"
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-foreground">{score}%</span>
    </div>
  )
}

export default async function AuditsPage() {
  const user = await requireModule("audits")
  const audits = await getAudits()
  const { t } = await getServerT()

  const fields: FieldDef[] = [
    { name: "title", label: t("auditsMod.fTitle"), required: true, full: true, placeholder: t("auditsMod.fTitlePlaceholder") },
    { name: "standard", label: t("auditsMod.fStandard"), placeholder: t("auditsMod.fStandardPlaceholder") },
    { name: "auditor", label: t("auditsMod.fAuditor") },
    { name: "score", label: t("auditsMod.fScorePct"), type: "number", min: 0, max: 100, defaultValue: 0 },
    { name: "status", label: t("auditsMod.fStatus"), type: "select", options: inspectionStatusOptions.map((o) => ({ value: o.value, label: statusLabel(t, o.value) })) },
    { name: "auditDate", label: t("auditsMod.fDate"), type: "date" },
  ]

  const avg = audits.length ? Math.round(audits.reduce((a, b) => a + (b.score ?? 0), 0) / audits.length) : 0
  const closed = audits.filter((a) => a.status === "closed").length
  const scheduled = audits.filter((a) => a.status === "scheduled").length

  const columns: Column<AuditItem>[] = [
    { key: "title", header: t("auditsMod.colAudit"), render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "standard", header: t("auditsMod.fStandard"), render: (r) => <span className="text-muted-foreground">{r.standard || "-"}</span> },
    { key: "auditor", header: t("auditsMod.fAuditor"), render: (r) => <span className="text-muted-foreground">{r.auditor || "-"}</span> },
    { key: "score", header: t("auditsMod.fScore"), render: (r) => <ScoreBar score={r.score ?? 0} /> },
    { key: "status", header: t("auditsMod.fStatus"), render: (r) => <StatusBadge status={r.status ?? "scheduled"} /> },
    { key: "auditDate", header: t("auditsMod.fDateCol"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.auditDate ?? "-"}</span> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="audits"
            recordId={r.id}
            title={r.title}
            subtitle="تقرير تدقيق"
            fields={[
              { label: "عنوان التدقيق", value: r.title },
              { label: "المعيار", value: r.standard || "-" },
              { label: "المدقق", value: r.auditor || "-" },
              { label: "النتيجة", value: `${r.score ?? 0}%` },
              { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
              { label: "تاريخ التدقيق", value: r.auditDate ?? "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteAudit} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title="التدقيق والامتثال"
      subtitle="إدارة عمليات التدقيق الداخلية والخارجية ومتابعة المطابقة للمعايير"
      user={user}
      action={<RecordDialog title="تدقيق جديد" description="سجّل عملية تدقيق." triggerLabel="تدقيق جديد" fields={fields} action={createAudit} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عمليات التدقيق" value={audits.length} icon={ClipboardList} tone="blue" />
        <KpiCard label="متوسط النتيجة" value={avg} unit="%" icon={Gauge} tone="primary" />
        <KpiCard label="مجدولة" value={scheduled} icon={FileWarning} tone="accent" />
        <KpiCard label="مغلقة" value={closed} icon={BadgeCheck} tone="primary" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">سجل عمليات التدقيق</h2>
        <DataTable columns={columns} rows={audits} emptyMessage="لا توجد عمليات تدقيق. أضف تدقيقاً جديداً للبدء." />
      </div>
    </AppShell>
  )
}
