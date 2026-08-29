import { getEquipment } from "@/app/actions/equipment"
import { getOperationalSettings } from "@/app/actions/org-settings"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { requireModule } from "@/lib/session"
import { Truck, CheckCircle2, Forklift } from "lucide-react"
import { EquipmentRegistry } from "@/app/equipment/equipment-registry"
import { getServerT } from "@/lib/i18n/server"

export default async function EquipmentPage() {
  const user = await requireModule("ai_monitoring")
  const [items, operational] = await Promise.all([getEquipment(), getOperationalSettings()])
  const vehicleTypes = operational.vehicleTypes.map((v) => v.label)
  const active = items.filter((i) => i.active).length
  const forklifts = items.filter((i) => i.equipmentType === "forklift").length
  const { t } = await getServerT()

  return (
    <AppShell title={t("pageHeaders.equipmentTitle")} subtitle={t("pageHeaders.equipmentSubtitle")} user={user}>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t("equipmentReg.kpiTotal")} value={items.length} icon={Truck} tone="blue" />
        <KpiCard label={t("equipmentReg.kpiActive")} value={active} icon={CheckCircle2} tone="primary" />
        <KpiCard label={t("equipmentReg.kpiForklifts")} value={forklifts} icon={Forklift} tone="accent" />
      </div>
      <EquipmentRegistry items={items} vehicleTypes={vehicleTypes} />
    </AppShell>
  )
}
