import { FolderKanban, FileText, FileClock, FileCheck2 } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireUser } from "@/lib/session"
import { getDocuments, createDocument, deleteDocument } from "@/app/actions/hse"
import { statusLabels } from "@/lib/labels"

type DocItem = Awaited<ReturnType<typeof getDocuments>>[number]

const docStatusOptions = [
  { value: "active", label: "ساري" },
  { value: "in_progress", label: "قيد المراجعة" },
  { value: "expired", label: "منتهٍ" },
]

const fields: FieldDef[] = [
  { name: "title", label: "اسم المستند", required: true, full: true, placeholder: "مثال: سياسة السلامة العامة" },
  { name: "category", label: "التصنيف", placeholder: "مثال: سياسات" },
  { name: "version", label: "الإصدار", defaultValue: "1.0" },
  { name: "owner", label: "الجهة المالكة" },
  { name: "status", label: "الحالة", type: "select", options: docStatusOptions },
  { name: "reviewDate", label: "تاريخ المراجعة", type: "date" },
]

export default async function DocumentsPage() {
  const user = await requireUser()
  const documents = await getDocuments()

  const active = documents.filter((d) => d.status === "active").length
  const review = documents.filter((d) => d.status === "in_progress").length
  const expired = documents.filter((d) => d.status === "expired").length

  const columns: Column<DocItem>[] = [
    {
      key: "title",
      header: "المستند",
      render: (r) => (
        <span className="flex items-center gap-2 font-medium text-foreground">
          <FileText className="size-4 text-muted-foreground" />
          {r.title}
        </span>
      ),
    },
    { key: "category", header: "التصنيف", render: (r) => <span className="text-muted-foreground">{r.category || "-"}</span> },
    { key: "version", header: "الإصدار", render: (r) => <span className="font-mono text-xs" dir="ltr">{r.version}</span> },
    { key: "owner", header: "الجهة المالكة", render: (r) => <span className="text-muted-foreground">{r.owner || "-"}</span> },
    { key: "reviewDate", header: "تاريخ المراجعة", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.reviewDate ?? "-"}</span> },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "active"} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="documents"
            recordId={r.id}
            title={r.title}
            subtitle="مستند"
            fields={[
              { label: "اسم المستند", value: r.title },
              { label: "التصنيف", value: r.category || "-" },
              { label: "الإصدار", value: r.version || "-" },
              { label: "الجهة المالكة", value: r.owner || "-" },
              { label: "تاريخ المراجعة", value: r.reviewDate ?? "-" },
              { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteDocument} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title="إدارة الوثائق"
      subtitle="مكتبة السياسات والإجراءات والخطط والسجلات الخاصة بالسلامة"
      user={user}
      action={<RecordDialog title="تسجيل مستند" description="سجّل مستنداً جديداً." triggerLabel="رفع مستند" fields={fields} action={createDocument} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي الوثائق" value={documents.length} icon={FolderKanban} tone="blue" />
        <KpiCard label="سارية" value={active} icon={FileCheck2} tone="primary" />
        <KpiCard label="قيد المراجعة" value={review} icon={FileClock} tone="accent" />
        <KpiCard label="منتهية" value={expired} icon={FileText} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">مكتبة الوثائق</h2>
        <DataTable columns={columns} rows={documents} emptyMessage="لا توجد وثائق. سجّل مستنداً جديداً للبدء." />
      </div>
    </AppShell>
  )
}
