import { getEquipment } from "@/app/actions/equipment"
import { getOperationalSettings } from "@/app/actions/org-settings"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { requireModule } from "@/lib/session"
import { Truck, CheckCircle2, Wrench, Ban } from "lucide-react"
import { EquipmentRegistry } from "@/app/equipment/equipment-registry"
import { getServerT } from "@/lib/i18n/server"

export default async function EquipmentPage() {
  const user = await requireModule("equipment")
  const [items, operational] = await Promise.all([getEquipment(), getOperationalSettings()])
  const vehicleTypes = operational.vehicleTypes.map((v) => v.label)
  const operationalCount = items.filter((i) => i.operationalStatus === "operational").length
  const maintenanceCount = items.filter((i) => i.operationalStatus === "maintenance").length
  const outOfServiceCount = items.filter((i) => i.operationalStatus === "out_of_service").length
  const { t } = await getServerT()

  return (
    <AppShell title={t("pageHeaders.equipmentTitle")} subtitle={t("pageHeaders.equipmentSubtitle")} user={user}>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("equipmentReg.kpiTotal")} value={items.length} icon={Truck} tone="blue" />
        <KpiCard label={t("equipmentReg.kpiOperational")} value={operationalCount} icon={CheckCircle2} tone="primary" />
        <KpiCard label={t("equipmentReg.kpiMaintenance")} value={maintenanceCount} icon={Wrench} tone="accent" />
        <KpiCard label={t("equipmentReg.kpiOutOfService")} value={outOfServiceCount} icon={Ban} tone="destructive" />
      </div>
      <EquipmentRegistry items={items} vehicleTypes={vehicleTypes} />
    </AppShell>
  )
}
