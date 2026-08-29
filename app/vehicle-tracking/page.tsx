import { getTrackingOverview, getVehiclesInside } from "@/app/actions/vehicle-tracking"
import { AppShell } from "@/components/app-shell"
import { requireModule } from "@/lib/session"
import { getServerT } from "@/lib/i18n/server"
import { VehicleTrackingClient } from "./vehicle-tracking-client"

export default async function VehicleTrackingPage() {
  const user = await requireModule("ai_monitoring")
  const [overview, inside] = await Promise.all([getTrackingOverview(), getVehiclesInside()])
  const { t } = await getServerT()

  return (
    <AppShell
      title={t("pageHeaders.vehicleTrackingTitle")}
      subtitle={t("pageHeaders.vehicleTrackingSubtitle")}
      user={user}
    >
      <VehicleTrackingClient initialOverview={overview} initialInside={inside} />
    </AppShell>
  )
}
