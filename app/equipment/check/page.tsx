import { AppShell } from "@/components/app-shell"
import { requireUser } from "@/lib/session"
import { getServerT } from "@/lib/i18n/server"
import {
  getEquipmentByQrToken,
  getEquipmentForCheck,
  getChecklistItemsForPower,
  listEquipmentForCheck,
  shiftForNow,
  type CheckEquipmentInfo,
  type ChecklistItemRow,
} from "@/app/actions/equipment-checks"
import { CheckForm } from "./check-form"
import { EquipmentPicker } from "./equipment-picker"

// نقطة دخول الفحص اليومي قبل التشغيل. يُفتح عبر:
//   - رمز QR على المعدة:  /equipment/check?token=eq_xxxxx
//   - اختيار يدوي:        /equipment/check?id=123
// إن لم يُحدَّد أيّهما تُعرَض قائمة اختيار المعدة (بديل مسح QR).
export default async function EquipmentCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; id?: string }>
}) {
  const user = await requireUser()
  const { t } = await getServerT()
  const sp = await searchParams

  let info: CheckEquipmentInfo | null = null
  if (sp.token) info = await getEquipmentByQrToken(sp.token)
  else if (sp.id) info = await getEquipmentForCheck(Number(sp.id))

  // لا معدة محدّدة → قائمة الاختيار اليدوي.
  if (!info) {
    const list = await listEquipmentForCheck()
    return (
      <AppShell title={t("pageHeaders.equipmentTitle")} subtitle={t("equipCheck.pickSubtitle")} user={user}>
        <EquipmentPicker list={list} notFound={Boolean(sp.token || sp.id)} />
      </AppShell>
    )
  }

  const items: ChecklistItemRow[] = await getChecklistItemsForPower(info.powerType)
  const currentShift = shiftForNow()

  return (
    <AppShell title={t("equipCheck.title")} subtitle={t("equipCheck.subtitle")} user={user}>
      <CheckForm info={info} items={items} currentShift={currentShift} operatorDefaultName={user.name} />
    </AppShell>
  )
}
