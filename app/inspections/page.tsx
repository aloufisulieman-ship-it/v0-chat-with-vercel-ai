import { ClipboardCheck, Gauge, AlertCircle, TrendingUp } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireUser } from "@/lib/session"
import { getInspections, createInspection, deleteInspection } from "@/app/actions/hse"
import { inspectionStatusOptions } from "@/lib/labels"
import { cn } from "@/lib/utils"

type Inspection = Awaited<ReturnType<typeof getInspections>>[number]

function ScoreBar({ score }: { score: number }) {
  const tone = score >= 90 ? "bg-primary" : score >= 75 ? "bg-accent" : "bg-destructive"
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-foreground">{score}%</span>
    </div>
  )
}

const fields: FieldDef[] = [
  { name: "title", label: "نوع التفتيش", required: true, full: true, placeholder: "مثال: تفتيش معدات مكافحة الحريق" },
  { name: "area", label: "المنطقة", placeholder: "مثال: ورشة الإنتاج" },
  { name: "inspector", label: "المفتش" },
  { name: "compliance", label: "نسبة الالتزام %", type: "number", min: 0, max: 100, defaultValue: 100 },
  { name: "findings", label: "عدد الملاحظات", type: "number", min: 0, defaultValue: 0 },
  { name: "status", label: "الحالة", type: "select", options: inspectionStatusOptions },
  { name: "inspectionDate", label: "تاريخ التفتيش", type: "date" },
]

export default async function InspectionsPage() {
  const user = await requireUser()
  const inspections = await getInspections()

  const avg = inspections.length ? Math.round(inspections.reduce((a, b) => a + (b.compliance ?? 0), 0) / inspections.length) : 0
  const findings = inspections.reduce((a, b) => a + (b.findings ?? 0), 0)
  const open = inspections.filter((i) => i.status !== "closed").length

  const columns: Column<Inspection>[] = [
    { key: "title", header: "نوع التفتيش", render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "area", header: "المنطقة", render: (r) => <span className="text-muted-foreground">{r.area || "-"}</span> },
    { key: "inspector", header: "المفتش", render: (r) => <span className="text-muted-foreground">{r.inspector || "-"}</span> },
    { key: "compliance", header: "الالتزام", render: (r) => <ScoreBar score={r.compliance ?? 0} /> },
    { key: "findings", header: "ملاحظات", className: "text-center" },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "scheduled"} /> },
    { key: "inspectionDate", header: "التاريخ", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.inspectionDate ?? "-"}</span> },
    { key: "actions", header: "", className: "text-left", render: (r) => <DeleteButton id={r.id} action={deleteInspection} /> },
  ]

  return (
    <AppShell
      title="عمليات التفتيش"
      subtitle="جدولة وتنفيذ عمليات التفتيش الميدانية ومتابعة الملاحظات"
      user={user}
      action={<RecordDialog title="تفتيش جديد" description="سجّل عملية تفتيش جديدة." triggerLabel="تفتيش جديد" fields={fields} action={createInspection} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي عمليات التفتيش" value={inspections.length} icon={ClipboardCheck} tone="blue" />
        <KpiCard label="متوسط الالتزام" value={avg} unit="%" icon={Gauge} tone="primary" />
        <KpiCard label="إجمالي الملاحظات" value={findings} icon={AlertCircle} tone="accent" />
        <KpiCard label="قيد المتابعة" value={open} icon={TrendingUp} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">سجل عمليات التفتيش</h2>
        <DataTable columns={columns} rows={inspections} emptyMessage="لا توجد عمليات تفتيش. أضف تفتيشاً جديداً للبدء." />
      </div>
    </AppShell>
  )
}
