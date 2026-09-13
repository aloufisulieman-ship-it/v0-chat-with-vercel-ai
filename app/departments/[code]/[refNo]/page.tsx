import Link from "next/link"
import { notFound } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import { requireModule } from "@/lib/session"
import { getReferralChainByRefNo } from "@/app/actions/referrals"
import { ReferralTimeline } from "@/components/departments/referral-timeline"
import { deptCodeLabels } from "@/lib/departments"
import { db } from "@/lib/db"
import { organization } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// خط سير معاملة واحدة عبر كل تحويلاتها لنفس السجل المصدر.
// المسار /departments/[code]/[refNo] حيث refNo رقم الإحالة REF-YYYY-###.
export default async function ReferralTimelinePage({
  params,
}: {
  params: Promise<{ code: string; refNo: string }>
}) {
  const user = await requireModule("departments")
  const { code, refNo } = await params
  const data = await getReferralChainByRefNo(code, decodeURIComponent(refNo))
  if (!data) notFound()

  const upper = code.toUpperCase()
  const deptName = deptCodeLabels[upper] || upper

  const orgRows = user.organizationId
    ? await db.select({ name: organization.name }).from(organization).where(eq(organization.id, user.organizationId)).limit(1)
    : []
  const orgName = orgRows[0]?.name ?? ""

  return (
    <AppShell title={`خط سير ${data.referral.refNo}`} subtitle="سجل غير قابل للتعديل لكل مراحل المعاملة" user={user}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2">
          <Link href="/departments">
            <ChevronRight className="size-4" />
            مركز الأقسام
          </Link>
        </Button>
        <span>/</span>
        <Button asChild variant="ghost" size="sm" className="h-8 px-2">
          <Link href={`/departments/${upper}`}>{deptName}</Link>
        </Button>
        <span>/</span>
        <span dir="ltr" className="font-mono text-foreground">
          {data.referral.refNo}
        </span>
      </div>

      <ReferralTimeline
        referral={data.referral}
        events={data.events}
        chainDepts={data.chainDepts}
        summary={data.summary}
        orgName={orgName}
      />
    </AppShell>
  )
}
