import { Building2, Users, Briefcase, CalendarDays } from "lucide-react"
import { Card } from "@/components/ui/card"
import { listOrganizations } from "@/app/actions/platform"
import { EnterOrganizationButton } from "@/components/enter-organization-button"

export const dynamic = "force-dynamic"

const dateFmt = new Intl.DateTimeFormat("ar", { year: "numeric", month: "long", day: "numeric" })

export default async function AdminOrganizationsPage() {
  const orgs = await listOrganizations()

  const totalEmployees = orgs.reduce((s, o) => s + o.employeeCount, 0)
  const totalUsers = orgs.reduce((s, o) => s + o.userCount, 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground text-balance">المؤسسات المسجّلة</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          عرض كل المؤسسات على المنصّة. ادخل أي مساحة لعرض بياناتها (عرض للقراءة فقط).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon={Building2} label="إجمالي المؤسسات" value={orgs.length} />
        <SummaryCard icon={Users} label="إجمالي المستخدمين" value={totalUsers} />
        <SummaryCard icon={Briefcase} label="إجمالي الموظفين" value={totalEmployees} />
      </div>

      {orgs.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">لا توجد مؤسسات مسجّلة بعد.</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {orgs.map((o) => (
            <Card key={o.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="size-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-foreground">{o.name}</span>
                    <StatusPill status={o.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Briefcase className="size-3.5" />
                      {o.sector}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" />
                      {o.employeeCount} موظف · {o.userCount} مستخدم
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {dateFmt.format(new Date(o.registeredAt))}
                    </span>
                  </div>
                </div>
              </div>
              <div className="shrink-0 md:pe-2">
                <EnterOrganizationButton orgId={o.id} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2
  label: string
  value: number
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-bold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </Card>
  )
}

function StatusPill({ status }: { status: "active" | "pending" }) {
  return status === "active" ? (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">نشطة</span>
  ) : (
    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent-foreground">قيد الإعداد</span>
  )
}
