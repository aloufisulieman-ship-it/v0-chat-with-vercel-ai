import { notFound } from "next/navigation"
import { getEquipmentById } from "@/app/actions/equipment"
import { AppShell } from "@/components/app-shell"
import { requireModule } from "@/lib/session"
import { getServerT } from "@/lib/i18n/server"
import { EquipmentDetailView } from "@/app/equipment/[id]/equipment-detail-view"

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("equipment")
  const { id } = await params
  const data = await getEquipmentById(Number(id))
  if (!data) notFound()
  const { t } = await getServerT()

  return (
    <AppShell title={t("pageHeaders.equipmentTitle")} subtitle={t("pageHeaders.equipmentSubtitle")} user={user}>
      <EquipmentDetailView
        item={data.item}
        violations={data.violations}
        incidents={data.incidents}
        inspections={data.inspections}
      />
    </AppShell>
  )
}
