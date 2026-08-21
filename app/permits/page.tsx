import { FileSignature, CheckCircle2, Clock, HardHat, Forklift, Bike, UserCheck, GraduationCap } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { PermitDialog } from "@/components/permit-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { PermitApprovalActions } from "@/components/permit-approval-actions"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getPermits, deletePermit, createPermit } from "@/app/actions/hse"
import { permitTypeExtraFields } from "@/lib/labels"
import { getServerT } from "@/lib/i18n/server"
import { permitTypeLabel, statusLabel } from "@/lib/i18n/labels"

type Permit = Awaited<ReturnType<typeof getPermits>>[number]

// أيقونة مميزة لكل نوع تصريح.
const permitTypeIcons: Record<string, LucideIcon> = {
  construction: HardHat,
  forklift: Forklift,
  tuktuk: Bike,
  visitor: UserCheck,
  trainee: GraduationCap,
}

// يحلّل الحقول الديناميكية المخزّنة كـ JSON في عمود details.
function parseDetails(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

export default async function PermitsPage() {
  const user = await requireModule("permits")
  const permits = await getPermits()
  const { locale, t } = await getServerT()

  // صلاحية اعتماد/رفض التصاريح: للمدير العام أو مفتش السلامة أو المشرف (admin).
  const canApprove =
    user.role === "admin" || user.department === "المدير العام" || user.department === "مفتش السلامة"

  const active = permits.filter((p) => p.status === "active" || p.status === "approved").length
  const pending = permits.filter((p) => p.status === "pending").length

  const columns: Column<Permit>[] = [
    {
      key: "documentNo",
      header: t("permits.colPermitNo"),
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          {r.documentNo || "-"}
        </span>
      ),
    },
    { key: "title", header: t("permits.colPermit"), render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    {
      key: "type",
      header: t("permits.colType"),
      render: (r) => {
        const Icon = permitTypeIcons[r.type ?? ""] ?? FileSignature
        return (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Icon className="size-4 text-primary" />
            {r.type ? permitTypeLabel(t, r.type) : "-"}
          </span>
        )
      },
    },
    { key: "location", header: t("permits.colLocation"), render: (r) => <span className="text-muted-foreground">{r.location || "-"}</span> },
    { key: "requestedBy", header: t("permits.colRequestedBy"), render: (r) => <span className="text-muted-foreground">{r.requestedBy || "-"}</span> },
    { key: "validFrom", header: t("permits.colFrom"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.validFrom ?? "-"}</span> },
    { key: "validTo", header: t("permits.colTo"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.validTo ?? "-"}</span> },
    { key: "status", header: t("permits.colStatus"), render: (r) => <StatusBadge status={r.status ?? "pending"} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {canApprove && r.status === "pending" && (
            <PermitApprovalActions permitId={r.id} approverName={user.name} />
          )}
          <RecordDetailsDialog
            module="permits"
            recordId={r.id}
            title={r.title}
            subtitle={r.type ? permitTypeLabel(t, r.type) : t("permits.defaultSubtitle")}
            fields={[
              { label: t("permits.fPermitNo"), value: r.documentNo || "-" },
              { label: t("permits.fPermitTitle"), value: r.title },
              { label: t("permits.fType"), value: r.type ? permitTypeLabel(t, r.type) : "-" },
              { label: t("permits.fLocation"), value: r.location || "-" },
              { label: t("permits.fAuthorized"), value: r.requestedBy || "-" },
              // الحقول الديناميكية الخاصة بكل نوع تصريح.
              ...(permitTypeExtraFields[r.type ?? ""] ?? []).map((f) => ({
                label: f.label,
                value: parseDetails(r.details)[f.name] || "-",
              })),
              { label: t("permits.fIssueDate"), value: r.validFrom ?? "-" },
              { label: t("permits.fExpiryDate"), value: r.validTo ?? "-" },
              { label: t("permits.fApprovalStatus"), value: r.status ? statusLabel(t, r.status) : "-" },
              ...(r.approvedBy
                ? [
                    { label: r.status === "rejected" ? t("permits.fRejectedBy") : t("permits.fApprovedBy"), value: r.approvedBy },
                    {
                      label: r.status === "rejected" ? t("permits.fRejectionDate") : t("permits.fApprovalDate"),
                      value: r.approvedAt ? new Date(r.approvedAt).toLocaleString(locale === "en" ? "en-US" : "ar") : "-",
                    },
                  ]
                : []),
              ...(r.status === "rejected" && r.rejectionReason
                ? [{ label: t("permits.fRejectionReason"), value: r.rejectionReason }]
                : []),
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deletePermit} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.permitsTitle")}
      subtitle={t("pageHeaders.permitsSubtitle")}
      user={user}
      action={<PermitDialog action={createPermit} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t("permits.totalPermits")} value={permits.length} icon={FileSignature} tone="blue" />
        <KpiCard label={t("permits.activePermits")} value={active} icon={Clock} tone="primary" />
        <KpiCard label={t("permits.pendingApproval")} value={pending} icon={CheckCircle2} tone="accent" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("permits.registryTitle")}</h2>
        <DataTable columns={columns} rows={permits} emptyMessage={t("permits.emptyMessage")} />
      </div>
    </AppShell>
  )
}
