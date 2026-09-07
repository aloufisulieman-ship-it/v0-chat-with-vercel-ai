import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { PermitDetailView } from "@/components/permit-detail-view"
import { requireModule, isOrgManager } from "@/lib/session"
import { getPermitById, expireOverduePermits } from "@/app/actions/permit-workflow"
import { getCompany } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"

// صفحة مستقلة لتفاصيل التصريح — قابلة للمشاركة والفتح على الجوال.
export default async function PermitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const permitId = Number(id)
  if (!Number.isFinite(permitId)) notFound()

  const user = await requireModule("permits")
  await expireOverduePermits(user.organizationId)
  const [permit, company] = await Promise.all([getPermitById(permitId), getCompany().catch(() => null)])
  if (!permit) notFound()

  const { t } = await getServerT()
  const isManager = user.isPlatformAdmin ? true : isOrgManager(user)

  return (
    <AppShell title={permit.documentNo ?? t("permitDetail.title")} subtitle={permit.title} user={user}>
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/permits" className="hover:text-foreground">
          {t("pageHeaders.permitsTitle")}
        </Link>
        <ChevronRight className="size-4 rtl:rotate-180" />
        <span className="text-foreground" dir="ltr">
          {permit.documentNo ?? `#${permit.id}`}
        </span>
      </nav>
      <PermitDetailView permit={permit} isManager={isManager} companyName={company?.name ?? null} />
    </AppShell>
  )
}
