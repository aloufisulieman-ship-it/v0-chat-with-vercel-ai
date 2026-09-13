import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Inbox, Clock, CheckCircle2, ChevronLeft } from "lucide-react"
import { deptCodeLabels } from "@/lib/departments"

type DeptStats = { open: number; closed: number; overdue: number; total: number }
type DeptRow = {
  id: number
  code: string
  nameAr: string
  slaHours: number
  isActive: boolean
  stats: DeptStats
}

// شبكة بطاقات الأقسام: لكل قسم عدد الإحالات الواردة المفتوحة والمتأخرة والمغلقة،
// مع رابط إلى صندوق واردهِ. تصميم هادئ يعتمد رموز التصميم (بلا ألوان ثابتة).
export function DepartmentsOverview({ departments }: { departments: DeptRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {departments.map((d) => {
        const name = d.nameAr || deptCodeLabels[d.code] || d.code
        return (
          <Link key={d.id} href={`/departments/${d.code}`} className="group">
            <Card className="flex h-full flex-col gap-4 p-5 transition-colors group-hover:border-primary/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="size-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground text-pretty">{name}</span>
                    <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                      {d.code}
                    </span>
                  </div>
                </div>
                <ChevronLeft className="size-5 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Stat icon={Inbox} label="مفتوحة" value={d.stats.open} tone="text-primary" />
                <Stat icon={Clock} label="متأخرة" value={d.stats.overdue} tone="text-destructive" />
                <Stat icon={CheckCircle2} label="مغلقة" value={d.stats.closed} tone="text-muted-foreground" />
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">مهلة المعالجة</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {d.slaHours} ساعة
                </Badge>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Inbox
  label: string
  value: number
  tone: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/40 p-2.5">
      <Icon className={`size-4 ${tone}`} />
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}
