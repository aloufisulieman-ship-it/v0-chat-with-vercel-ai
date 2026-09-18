import { ClipboardList, BadgeCheck, FileWarning, Gauge, Pencil } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { isAuditor } from "@/lib/permissions"
import {
  getAudits,
  createAudit,
  updateAudit,
  deleteAudit,
  getInternalAudits,
  createInternalAudit,
  updateInternalAudit,
  deleteInternalAudit,
} from "@/app/actions/hse"
import { inspectionStatusOptions } from "@/lib/labels"
import { AuditStatusControl } from "./audit-status-control"
import { getServerT } from "@/lib/i18n/server"
import { statusLabel } from "@/lib/i18n/labels"
import { cn } from "@/lib/utils"

type AuditItem = Awaited<ReturnType<typeof getAudits>>[number]
type InternalAuditItem = Awaited<ReturnType<typeof getInternalAudits>>[number]

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
  const [audits, internalAudits] = await Promise.all([getAudits(), getInternalAudits()])
  const { t } = await getServerT()
  const isAdmin = user.role === "admin"
  // تغيير حالة التدقيق: نفس شرط الخادم بالضبط (canChangeAuditStatus في
  // app/actions/hse.ts) — admin، أو auditor، أو (manager + قسم HSE تحديداً).
  // مفتش السلامة الميداني (department = "inspector") يرى التدقيق فقط ولا يغيّره.
  const canChangeStatus = user.role === "admin" || isAuditor(user.role) || (user.role === "manager" && user.department === "hse")
  const statusOptions = inspectionStatusOptions.map((o) => ({ value: o.value, label: statusLabel(t, o.value) }))

  // نفس تعريف الحقول للإضافة والتعديل؛ التعديل يمرّرها بالقيم الحالية كقيم افتراضية.
  const auditFields = (r?: AuditItem): FieldDef[] => [
    { name: "title", label: t("auditsMod.fTitle"), required: true, full: true, placeholder: t("auditsMod.fTitlePlaceholder"), defaultValue: r?.title },
    { name: "standard", label: t("auditsMod.fStandard"), placeholder: t("auditsMod.fStandardPlaceholder"), defaultValue: r?.standard ?? "" },
    { name: "auditor", label: t("auditsMod.fAuditor"), defaultValue: r?.auditor ?? "" },
    { name: "score", label: t("auditsMod.fScorePct"), type: "number", min: 0, max: 100, defaultValue: r?.score ?? 0 },
    // الحالة تُدار من AuditStatusControl؛ تظهر هنا لمن يملك تغييرها فقط.
    ...(canChangeStatus
      ? [{ name: "status", label: t("auditsMod.fStatus"), type: "select" as const, options: statusOptions, defaultValue: r?.status ?? "scheduled" }]
      : []),
    { name: "auditDate", label: t("auditsMod.fDate"), type: "date", defaultValue: r?.auditDate ?? "" },
  ]
  const fields = auditFields()

  const internalFields = (r?: InternalAuditItem): FieldDef[] => [
    { name: "title", label: t("auditsMod.fTitle"), required: true, full: true, placeholder: t("auditsMod.fTitlePlaceholder"), defaultValue: r?.title },
    { name: "scope", label: t("auditsMod.fScope"), full: true, placeholder: t("auditsMod.fScopePlaceholder"), defaultValue: r?.scope ?? "" },
    { name: "auditor", label: t("auditsMod.fAuditor"), defaultValue: r?.auditor ?? "" },
    { name: "auditDate", label: t("auditsMod.fDate"), type: "date", defaultValue: r?.auditDate ?? "" },
    { name: "nonconformities", label: t("auditsMod.fNonconformities"), type: "number", min: 0, defaultValue: r?.nonconformities ?? 0 },
    { name: "status", label: t("auditsMod.fStatus"), type: "select", options: statusOptions, defaultValue: r?.status ?? "scheduled" },
    { name: "result", label: t("auditsMod.fResult"), type: "textarea", defaultValue: r?.result ?? "" },
  ]

  const editTrigger = (label: string) => (
    <button
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label={label}
    >
      <Pencil className="size-4" />
    </button>
  )

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
            subtitle={t("auditsMod.detailsSubtitle")}
            fields={[
              { label: t("auditsMod.fTitle"), value: r.title },
              { label: t("auditsMod.fStandard"), value: r.standard || "-" },
              { label: t("auditsMod.fAuditor"), value: r.auditor || "-" },
              { label: t("auditsMod.fScore"), value: `${r.score ?? 0}%` },
              { label: t("auditsMod.fStatus"), value: r.status ? statusLabel(t, r.status) : "-" },
              { label: t("auditsMod.fDate"), value: r.auditDate ?? "-" },
            ]}
            extraSection={
              <AuditStatusControl
                auditId={r.id}
                status={r.status ?? "scheduled"}
                statusChangedBy={r.statusChangedBy}
                statusChangedAt={r.statusChangedAt}
                canChange={canChangeStatus}
              />
            }
            initialAttachments={[]}
          />
          <RecordDialog
            title={t("auditsMod.editTitle")}
            description={t("auditsMod.editDesc")}
            fields={auditFields(r)}
            action={updateAudit}
            hiddenFields={{ id: r.id }}
            allowAuditor
            trigger={editTrigger(t("auditsMod.editAria"))}
          />
          <DeleteButton id={r.id} action={deleteAudit} />
        </div>
      ),
    },
  ]

  const internalColumns: Column<InternalAuditItem>[] = [
    { key: "title", header: t("auditsMod.colAudit"), render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "scope", header: t("auditsMod.fScope"), render: (r) => <span className="text-muted-foreground line-clamp-1 max-w-xs">{r.scope || "-"}</span> },
    { key: "auditor", header: t("auditsMod.fAuditor"), render: (r) => <span className="text-muted-foreground">{r.auditor || "-"}</span> },
    { key: "nonconformities", header: t("auditsMod.fNonconformities"), render: (r) => <span className="font-mono text-xs text-foreground" dir="ltr">{r.nonconformities}</span> },
    { key: "status", header: t("auditsMod.fStatus"), render: (r) => <StatusBadge status={r.status ?? "scheduled"} /> },
    { key: "auditDate", header: t("auditsMod.fDateCol"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.auditDate ?? "-"}</span> },
    ...(isAdmin
      ? [
          {
            key: "actions",
            header: "",
            className: "text-left",
            render: (r: InternalAuditItem) => (
              <div className="flex items-center justify-end gap-1">
                <RecordDialog
                  title={t("auditsMod.internalEditTitle")}
                  description={t("auditsMod.internalEditDesc")}
                  fields={internalFields(r)}
                  action={updateInternalAudit}
                  hiddenFields={{ id: r.id }}
                  trigger={editTrigger(t("auditsMod.editAria"))}
                />
                <DeleteButton id={r.id} action={deleteInternalAudit} />
              </div>
            ),
          } as Column<InternalAuditItem>,
        ]
      : []),
  ]

  return (
    <AppShell
      title={t("pageHeaders.auditsTitle")}
      subtitle={t("pageHeaders.auditsSubtitle")}
      user={user}
      action={<RecordDialog title={t("auditsMod.dialogTitle")} description={t("auditsMod.dialogDesc")} triggerLabel={t("auditsMod.trigger")} fields={fields} action={createAudit} allowAuditor />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("auditsMod.kpiTotal")} value={audits.length} icon={ClipboardList} tone="blue" />
        <KpiCard label={t("auditsMod.kpiAvg")} value={avg} unit="%" icon={Gauge} tone="primary" />
        <KpiCard label={t("auditsMod.kpiScheduled")} value={scheduled} icon={FileWarning} tone="accent" />
        <KpiCard label={t("auditsMod.kpiClosed")} value={closed} icon={BadgeCheck} tone="primary" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("auditsMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={audits} emptyMessage={t("auditsMod.emptyMessage")} />
      </div>

      {/* التدقيق الداخلي (ISO 45001 §9.2): سجل مستقل يدخل في حساب نسبة المطابقة،
          وإدارته (إضافة/تعديل/حذف) لمدير النظام فقط. */}
      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{t("auditsMod.internalTitle")}</h2>
          {isAdmin ? (
            <RecordDialog
              title={t("auditsMod.internalDialogTitle")}
              description={t("auditsMod.internalDialogDesc")}
              triggerLabel={t("auditsMod.internalTrigger")}
              fields={internalFields()}
              action={createInternalAudit}
            />
          ) : (
            <p className="text-xs text-muted-foreground">{t("auditsMod.internalAdminOnly")}</p>
          )}
        </div>
        <DataTable columns={internalColumns} rows={internalAudits} emptyMessage={t("auditsMod.internalEmpty")} />
      </div>
    </AppShell>
  )
}
