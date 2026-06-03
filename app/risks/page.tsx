import { ShieldAlert, Flame, ShieldCheck, Layers } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge, SeverityBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { RiskMatrix } from "@/components/risk-matrix"
import { requireUser } from "@/lib/session"
import { getRisks, createRisk, deleteRisk } from "@/app/actions/hse"
import { statusOptions, riskLevel, statusLabels } from "@/lib/labels"

type RiskItem = Awaited<ReturnType<typeof getRisks>>[number]

const scoreOptions = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))

const fields: FieldDef[] = [
  { name: "hazard", label: "الخطر", required: true, full: true, placeholder: "مثال: التعرض للضوضاء العالية" },
  { name: "activity", label: "النشاط", placeholder: "مثال: تشغيل المولدات" },
  { name: "owner", label: "المسؤول" },
  { name: "likelihood", label: "الاحتمالية (1-5)", type: "select", options: scoreOptions },
  { name: "consequence", label: "الشدة (1-5)", type: "select", options: scoreOptions },
  { name: "status", label: "الحالة", type: "select", options: statusOptions },
  { name: "controls", label: "إجراءات التحكم", type: "textarea" },
]

export default async function RisksPage() {
  const user = await requireUser()
  const risks = await getRisks()

  const scored = risks.map((r) => ({ ...r, score: (r.likelihood ?? 1) * (r.consequence ?? 1) }))
  const critical = scored.filter((r) => r.score >= 15).length
  const high = scored.filter((r) => r.score >= 9 && r.score < 15).length
  const controlled = risks.filter((r) => r.status === "closed").length
  const avgScore = scored.length ? Math.round(scored.reduce((a, b) => a + b.score, 0) / scored.length) : 0

  const columns: Column<(typeof scored)[number]>[] = [
    { key: "hazard", header: "الخطر", render: (r) => <span className="font-medium text-foreground">{r.hazard}</span> },
    { key: "activity", header: "النشاط", render: (r) => <span className="text-muted-foreground">{r.activity || "-"}</span> },
    { key: "score", header: "التقييم", render: (r) => <span className="font-mono text-sm font-semibold text-foreground">{r.score}</span> },
    { key: "level", header: "المستوى", render: (r) => <SeverityBadge severity={riskLevel(r.score).value} /> },
    { key: "controls", header: "إجراءات التحكم", render: (r) => <span className="text-muted-foreground">{r.controls || "-"}</span> },
    { key: "owner", header: "المسؤول", render: (r) => <span className="text-muted-foreground">{r.owner || "-"}</span> },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "open"} /> },
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
            subtitle="تقييم خطر"
            fields={[
              { label: "الخطر", value: r.hazard },
              { label: "النشاط", value: r.activity || "-" },
              { label: "الاحتمالية", value: String(r.likelihood ?? 1) },
              { label: "الشدة", value: String(r.consequence ?? 1) },
              { label: "درجة المخاطرة", value: String(r.score) },
              { label: "المستوى", value: riskLevel(r.score).label },
              { label: "إجراءات التحكم", value: r.controls || "-" },
              { label: "المسؤول", value: r.owner || "-" },
              { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
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
      title="تقييم المخاطر"
      subtitle="تحديد وتقييم ومعالجة المخاطر المهنية والبيئية"
      user={user}
      action={<RecordDialog title="تقييم خطر جديد" description="درجة المخاطرة = الاحتمالية × الشدة." triggerLabel="تقييم جديد" fields={fields} action={createRisk} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي المخاطر" value={risks.length} icon={Layers} tone="blue" />
        <KpiCard label="مخاطر حرجة" value={critical} icon={Flame} tone="destructive" />
        <KpiCard label="مخاطر عالية" value={high} icon={ShieldAlert} tone="accent" />
        <KpiCard label="تحت السيطرة" value={controlled} icon={ShieldCheck} tone="primary" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RiskMatrix risks={risks} />
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-base font-semibold text-foreground">منهجية التقييم</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              يتم تقييم كل خطر بضرب درجة الاحتمالية (1-5) في درجة الشدة (1-5) للحصول على درجة المخاطرة.
              تُصنّف المخاطر إلى أربعة مستويات: منخفض، متوسط، عالٍ، وحرج. تتطلب المخاطر العالية والحرجة
              إجراءات تحكم فورية ومراجعة من إدارة السلامة.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{avgScore}</p>
              <p className="text-xs text-muted-foreground">متوسط درجة المخاطرة</p>
            </div>
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{risks.length ? Math.round((controlled / risks.length) * 100) : 0}%</p>
              <p className="text-xs text-muted-foreground">نسبة المخاطر المعالجة</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">سجل المخاطر</h2>
        <DataTable columns={columns} rows={scored} emptyMessage="لا توجد مخاطر مسجلة. أضف تقييماً جديداً للبدء." />
      </div>
    </AppShell>
  )
}
