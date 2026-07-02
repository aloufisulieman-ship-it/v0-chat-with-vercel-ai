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
import { permitTypeLabels, permitTypeExtraFields, statusLabels } from "@/lib/labels"

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

  // صلاحية اعتماد/رفض التصاريح: للمدير العام أو مفتش السلامة أو المشرف (admin).
  const canApprove =
    user.role === "admin" || user.department === "المدير العام" || user.department === "مفتش السلامة"

  const active = permits.filter((p) => p.status === "active" || p.status === "approved").length
  const pending = permits.filter((p) => p.status === "pending").length

  const columns: Column<Permit>[] = [
    {
      key: "documentNo",
      header: "رقم التصريح",
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          {r.documentNo || "-"}
        </span>
      ),
    },
    { key: "title", header: "التصريح", render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    {
      key: "type",
      header: "النوع",
      render: (r) => {
        const Icon = permitTypeIcons[r.type ?? ""] ?? FileSignature
        return (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Icon className="size-4 text-primary" />
            {permitTypeLabels[r.type ?? ""] ?? "-"}
          </span>
        )
      },
    },
    { key: "location", header: "الموقع", render: (r) => <span className="text-muted-foreground">{r.location || "-"}</span> },
    { key: "requestedBy", header: "مقدّم الطلب", render: (r) => <span className="text-muted-foreground">{r.requestedBy || "-"}</span> },
    { key: "validFrom", header: "من", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.validFrom ?? "-"}</span> },
    { key: "validTo", header: "إلى", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.validTo ?? "-"}</span> },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "pending"} /> },
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
            subtitle={permitTypeLabels[r.type ?? ""] ?? "تصريح عمل"}
            fields={[
              { label: "رقم التصريح", value: r.documentNo || "-" },
              { label: "عنوان التصريح", value: r.title },
              { label: "النوع", value: permitTypeLabels[r.type ?? ""] ?? "-" },
              { label: "الموقع", value: r.location || "-" },
              { label: "الجهة/الشخص المصرّح له", value: r.requestedBy || "-" },
              // الحقول الديناميكية الخاصة بكل نوع تصريح.
              ...(permitTypeExtraFields[r.type ?? ""] ?? []).map((f) => ({
                label: f.label,
                value: parseDetails(r.details)[f.name] || "-",
              })),
              { label: "تاريخ الإصدار", value: r.validFrom ?? "-" },
              { label: "تاريخ الانتهاء", value: r.validTo ?? "-" },
              { label: "حالة الاعتماد", value: statusLabels[r.status ?? ""] ?? "-" },
              ...(r.approvedBy
                ? [
                    { label: r.status === "rejected" ? "رفض بواسطة" : "اعتمد بواسطة", value: r.approvedBy },
                    {
                      label: r.status === "rejected" ? "تاريخ الرفض" : "تاريخ الاعتماد",
                      value: r.approvedAt ? new Date(r.approvedAt).toLocaleString("ar") : "-",
                    },
                  ]
                : []),
              ...(r.status === "rejected" && r.rejectionReason
                ? [{ label: "سبب الرفض", value: r.rejectionReason }]
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
      title="تصاريح العمل"
      subtitle="إصدار ومراقبة تصاريح العمل عالية الخطورة (PTW)"
      user={user}
      action={<PermitDialog action={createPermit} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="إجمالي التصاريح" value={permits.length} icon={FileSignature} tone="blue" />
        <KpiCard label="تصاريح نشطة" value={active} icon={Clock} tone="primary" />
        <KpiCard label="بانتظار الاعتماد" value={pending} icon={CheckCircle2} tone="accent" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">سجل تصاريح العمل</h2>
        <DataTable columns={columns} rows={permits} emptyMessage="لا توجد تصاريح. أصدر تصريحاً جديداً للبدء." />
      </div>
    </AppShell>
  )
}
