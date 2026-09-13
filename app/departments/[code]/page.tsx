import Link from "next/link"
import { notFound } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { Button } from "@/components/ui/button"
import { ChevronRight, Inbox, Clock, CheckCircle2 } from "lucide-react"
import { requireModule } from "@/lib/session"
import { getDepartmentInbox } from "@/app/actions/referrals"
import { DepartmentInbox } from "@/components/departments/department-inbox"
import { deptCodeLabels, isOverdue } from "@/lib/departments"

// صندوق وارد قسم واحد: كل الإحالات الموجّهة إليه، مبوّبة حسب نوع السجل، مع إجراءات
// دورة الحياة. المسار /departments/[code] حيث code رمز القسم (HSE/HR/FIN/...).
export default async function DepartmentInboxPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireModule("departments")
  const { code } = await params
  const upper = code.toUpperCase()
  const { dept, items } = await getDepartmentInbox(upper)
  if (!dept) notFound()

  const name = dept.nameAr || deptCodeLabels[dept.code] || dept.code
  const open = items.filter((it) => it.status !== "closed").length
  const overdue = items.filter((it) => isOverdue(it.dueAt, it.status)).length
  const closed = items.filter((it) => it.status === "closed").length

  // تسلسل البيانات إلى نص ISO لتمريرها لمكوّن العميل.
  const serialized = items.map((it) => ({
    id: it.id,
    refNo: it.refNo,
    sourceType: it.sourceType,
    sourceId: it.sourceId,
    priority: it.priority,
    status: it.status,
    notes: it.notes,
    createdByName: it.createdByName,
    dueAt: it.dueAt ? it.dueAt.toISOString() : null,
    createdAt: it.createdAt.toISOString(),
    closedBy: it.closedBy,
    closureNote: it.closureNote,
  }))

  return (
    <AppShell title={name} subtitle="الإحالات الواردة إلى القسم ومتابعة معالجتها" user={user}>
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2">
          <Link href="/departments">
            <ChevronRight className="size-4" />
            مركز الأقسام
          </Link>
        </Button>
        <span>/</span>
        <span className="text-foreground">{name}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="مفتوحة" value={open} icon={Inbox} tone="primary" />
        <KpiCard label="متأخرة" value={overdue} icon={Clock} tone="destructive" />
        <KpiCard label="مغلقة" value={closed} icon={CheckCircle2} tone="accent" />
      </div>

      <div className="mt-6">
        <DepartmentInbox items={serialized} />
      </div>
    </AppShell>
  )
}
