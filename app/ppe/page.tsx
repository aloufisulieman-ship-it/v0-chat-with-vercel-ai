import { HardHat, PackageCheck, PackageX, Boxes } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireUser } from "@/lib/session"
import { getPpe, createPpe, deletePpe } from "@/app/actions/hse"
import { cn } from "@/lib/utils"

type PPEItem = Awaited<ReturnType<typeof getPpe>>[number]

function StockBadge({ low }: { low: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        low ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/10 text-primary",
      )}
    >
      {low ? "مخزون منخفض" : "متوفر"}
    </span>
  )
}

const fields: FieldDef[] = [
  { name: "name", label: "اسم المعدة", required: true, full: true, placeholder: "مثال: خوذة سلامة" },
  { name: "category", label: "التصنيف", placeholder: "مثال: حماية الرأس" },
  { name: "inStock", label: "الكمية في المخزون", type: "number", min: 0, defaultValue: 0 },
  { name: "assigned", label: "المصروف للموظفين", type: "number", min: 0, defaultValue: 0 },
  { name: "minLevel", label: "الحد الأدنى", type: "number", min: 0, defaultValue: 0 },
]

export default async function PPEPage() {
  const user = await requireUser()
  const ppeStock = await getPpe()

  const isLow = (p: PPEItem) => (p.inStock ?? 0) < (p.minLevel ?? 0)
  const lowStock = ppeStock.filter(isLow).length
  const totalStock = ppeStock.reduce((a, b) => a + (b.inStock ?? 0), 0)
  const totalAssigned = ppeStock.reduce((a, b) => a + (b.assigned ?? 0), 0)

  const columns: Column<PPEItem>[] = [
    { key: "name", header: "المعدة", render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    { key: "category", header: "التصنيف", render: (r) => <span className="text-muted-foreground">{r.category || "-"}</span> },
    { key: "inStock", header: "المخزون", className: "text-center", render: (r) => <span className="font-semibold text-foreground">{r.inStock}</span> },
    { key: "minLevel", header: "الحد الأدنى", className: "text-center" },
    { key: "assigned", header: "المصروف", className: "text-center" },
    { key: "stat", header: "الحالة", render: (r) => <StockBadge low={isLow(r)} /> },
    { key: "actions", header: "", className: "text-left", render: (r) => <DeleteButton id={r.id} action={deletePpe} /> },
  ]

  return (
    <AppShell
      title="معدات الوقاية الشخصية"
      subtitle="إدارة مخزون وتوزيع معدات الوقاية الشخصية (PPE)"
      user={user}
      action={<RecordDialog title="إضافة صنف معدات" description="سجّل صنف معدات وقاية." triggerLabel="إضافة مخزون" fields={fields} action={createPpe} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="أصناف المعدات" value={ppeStock.length} icon={HardHat} tone="blue" />
        <KpiCard label="إجمالي المخزون" value={totalStock} icon={Boxes} tone="primary" />
        <KpiCard label="المصروف للموظفين" value={totalAssigned} icon={PackageCheck} tone="accent" />
        <KpiCard label="أصناف منخفضة" value={lowStock} icon={PackageX} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">مخزون المعدات</h2>
        <DataTable columns={columns} rows={ppeStock} emptyMessage="لا توجد معدات مسجلة. أضف صنفاً جديداً للبدء." />
      </div>
    </AppShell>
  )
}
