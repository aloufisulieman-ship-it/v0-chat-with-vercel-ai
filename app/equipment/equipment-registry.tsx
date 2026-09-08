"use client"

import { useActionState, useMemo, useState } from "react"
import Link from "next/link"
import { Eye, Pencil, Plus, Search, Trash2, Truck } from "lucide-react"
import { createEquipment, deleteEquipment, updateEquipment } from "@/app/actions/equipment"
import { equipmentTypeOptions, equipmentTypeLabels, operationalStatusOptions, operationalStatusLabels } from "@/lib/labels"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useI18n } from "@/lib/i18n/client"

export type EquipmentRecord = {
  id: number
  fleetNo: string
  plateNumber: string
  equipmentType: string
  manufacturer: string
  model: string
  serialNumber: string
  yearMade: number | null
  capacity: string
  operationalStatus: string
  location: string
  purchaseDate: string | null
  lastInspectionDate: string | null
  nextInspectionDate: string | null
  ownerCompany: string
  driverName: string
  internalCode: string
  active: boolean
  notes: string
}

type EquipmentAction = (formData: FormData) => Promise<void>

// لون شارة حالة التشغيل حسب القيمة.
function opStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "operational") return "default"
  if (status === "maintenance") return "secondary"
  if (status === "out_of_service") return "destructive"
  return "outline"
}

function Field({ id, label, children }: { id?: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function EquipmentDialog({ item, typeOptions }: { item?: EquipmentRecord; typeOptions: { value: string; label: string }[] }) {
  const { t, dir } = useI18n()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(item?.active ?? true)
  const [type, setType] = useState(item?.equipmentType ?? typeOptions[0]?.value ?? "forklift")
  const [opStatus, setOpStatus] = useState(item?.operationalStatus ?? "operational")
  const action: EquipmentAction = item ? updateEquipment : createEquipment
  const [, formAction, pending] = useActionState(async (_: null, formData: FormData) => {
    await action(formData)
    setOpen(false)
    return null
  }, null)
  const uid = item?.id ?? "new"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="icon" aria-label={t("equipmentReg.editAria").replace("{plate}", item.fleetNo || item.plateNumber)}><Pencil /></Button>
        ) : (
          <Button><Plus data-icon="inline-start" />{t("equipmentReg.addEquipment")}</Button>
        )}
      </DialogTrigger>
      <DialogContent dir={dir} className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? t("equipmentReg.dialogEditTitle") : t("equipmentReg.dialogAddTitle")}</DialogTitle>
          <DialogDescription>{t("equipmentReg.dialogDesc")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-5">
          {item && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="active" value={String(active)} />
          <input type="hidden" name="equipmentType" value={type} />
          <input type="hidden" name="operationalStatus" value={opStatus} />

          {/* التعريف */}
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-sm font-semibold text-foreground">{t("equipmentReg.sectionIdentity")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`eq-fleet-${uid}`} label={t("equipmentReg.fFleetNo")}>
                <Input id={`eq-fleet-${uid}`} name="fleetNo" defaultValue={item?.fleetNo} dir="ltr" placeholder={t("equipmentReg.fFleetNoPlaceholder")} />
              </Field>
              <Field label={t("equipmentReg.fType")}>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id={`eq-plate-${uid}`} label={t("equipmentReg.fPlate")}>
                <Input id={`eq-plate-${uid}`} name="plateNumber" defaultValue={item?.plateNumber} dir="ltr" placeholder={t("equipmentReg.fPlatePlaceholder")} />
                <span className="text-xs text-muted-foreground">{t("equipmentReg.fPlateHint")}</span>
              </Field>
              <Field id={`eq-owner-${uid}`} label={t("equipmentReg.fOwner")}>
                <Input id={`eq-owner-${uid}`} name="ownerCompany" defaultValue={item?.ownerCompany} />
              </Field>
              <Field id={`eq-driver-${uid}`} label={t("equipmentReg.fDriver")}>
                <Input id={`eq-driver-${uid}`} name="driverName" defaultValue={item?.driverName} />
              </Field>
              <Field id={`eq-code-${uid}`} label={t("equipmentReg.fInternalCode")}>
                <Input id={`eq-code-${uid}`} name="internalCode" defaultValue={item?.internalCode} dir="ltr" />
              </Field>
            </div>
          </fieldset>

          {/* المواصفات */}
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-sm font-semibold text-foreground">{t("equipmentReg.sectionSpecs")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`eq-manu-${uid}`} label={t("equipmentReg.fManufacturer")}>
                <Input id={`eq-manu-${uid}`} name="manufacturer" defaultValue={item?.manufacturer} />
              </Field>
              <Field id={`eq-model-${uid}`} label={t("equipmentReg.fModel")}>
                <Input id={`eq-model-${uid}`} name="model" defaultValue={item?.model} />
              </Field>
              <Field id={`eq-serial-${uid}`} label={t("equipmentReg.fSerial")}>
                <Input id={`eq-serial-${uid}`} name="serialNumber" defaultValue={item?.serialNumber} dir="ltr" />
              </Field>
              <Field id={`eq-year-${uid}`} label={t("equipmentReg.fYear")}>
                <Input id={`eq-year-${uid}`} name="yearMade" type="number" min="1950" max="2100" defaultValue={item?.yearMade ?? undefined} dir="ltr" />
              </Field>
              <Field id={`eq-capacity-${uid}`} label={t("equipmentReg.fCapacity")}>
                <Input id={`eq-capacity-${uid}`} name="capacity" defaultValue={item?.capacity} placeholder={t("equipmentReg.fCapacityPlaceholder")} />
              </Field>
              <Field id={`eq-location-${uid}`} label={t("equipmentReg.fLocation")}>
                <Input id={`eq-location-${uid}`} name="location" defaultValue={item?.location} />
              </Field>
            </div>
          </fieldset>

          {/* الحالة والفحص */}
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-sm font-semibold text-foreground">{t("equipmentReg.sectionInspection")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("equipmentReg.fOpStatus")}>
                <Select value={opStatus} onValueChange={setOpStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {operationalStatusOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id={`eq-purchase-${uid}`} label={t("equipmentReg.fPurchaseDate")}>
                <Input id={`eq-purchase-${uid}`} name="purchaseDate" type="date" defaultValue={item?.purchaseDate ?? undefined} dir="ltr" />
              </Field>
              <Field id={`eq-lastinsp-${uid}`} label={t("equipmentReg.fLastInspection")}>
                <Input id={`eq-lastinsp-${uid}`} name="lastInspectionDate" type="date" defaultValue={item?.lastInspectionDate ?? undefined} dir="ltr" />
              </Field>
              <Field id={`eq-nextinsp-${uid}`} label={t("equipmentReg.fNextInspection")}>
                <Input id={`eq-nextinsp-${uid}`} name="nextInspectionDate" type="date" defaultValue={item?.nextInspectionDate ?? undefined} dir="ltr" />
              </Field>
            </div>
            <Field id={`eq-notes-${uid}`} label={t("equipmentReg.fNotes")}>
              <Input id={`eq-notes-${uid}`} name="notes" defaultValue={item?.notes} />
            </Field>
          </fieldset>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`eq-active-${uid}`}>{t("equipmentReg.fStatus")}</Label>
              <span className="text-sm text-muted-foreground">{t("equipmentReg.activeHint")}</span>
            </div>
            <Switch id={`eq-active-${uid}`} checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter><Button type="submit" disabled={pending}>{pending ? t("equipmentReg.saving") : t("equipmentReg.save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteEquipmentButton({ item }: { item: EquipmentRecord }) {
  const { t, dir } = useI18n()
  const labelId = item.fleetNo || item.plateNumber
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={t("equipmentReg.deleteAria").replace("{plate}", labelId)}><Trash2 /></Button></AlertDialogTrigger>
      <AlertDialogContent dir={dir}>
        <AlertDialogHeader><AlertDialogTitle>{t("equipmentReg.deleteTitle")}</AlertDialogTitle><AlertDialogDescription>{t("equipmentReg.deleteDesc").replace("{plate}", labelId)}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("equipmentReg.cancel")}</AlertDialogCancel>
          <form action={deleteEquipment}><input type="hidden" name="id" value={item.id} /><AlertDialogAction type="submit">{t("equipmentReg.confirmDelete")}</AlertDialogAction></form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function EquipmentRegistry({
  items,
  vehicleTypes,
}: {
  items: EquipmentRecord[]
  vehicleTypes?: string[]
}) {
  const { t, dir } = useI18n()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const typeOptions =
    vehicleTypes && vehicleTypes.length > 0
      ? vehicleTypes.map((label) => ({ value: label, label }))
      : equipmentTypeOptions
  const typeLabelMap: Record<string, string> = { ...equipmentTypeLabels }
  for (const o of typeOptions) typeLabelMap[o.value] = o.label

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((it) => {
      if (typeFilter !== "all" && it.equipmentType !== typeFilter) return false
      if (statusFilter !== "all" && it.operationalStatus !== statusFilter) return false
      if (!q) return true
      return [it.fleetNo, it.plateNumber, it.manufacturer, it.model, it.serialNumber, it.driverName, it.location]
        .some((v) => (v || "").toLowerCase().includes(q))
    })
  }, [items, search, typeFilter, statusFilter])

  return (
    <section className="flex flex-col gap-4" dir={dir}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-semibold text-foreground">{t("equipmentReg.heading")}</h2><p className="text-sm text-muted-foreground">{t("equipmentReg.subtitle")}</p></div>
        <EquipmentDialog typeOptions={typeOptions} />
      </div>

      {/* الفلاتر */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("equipmentReg.searchPlaceholder")} className="ltr:pl-9 rtl:pr-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("equipmentReg.filterAllTypes")}</SelectItem>
            {typeOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("equipmentReg.filterAllStatuses")}</SelectItem>
            {operationalStatusOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("equipmentReg.colFleet")}</TableHead>
              <TableHead>{t("equipmentReg.colPlate")}</TableHead>
              <TableHead>{t("equipmentReg.colType")}</TableHead>
              <TableHead>{t("equipmentReg.colOpStatus")}</TableHead>
              <TableHead>{t("equipmentReg.colLocation")}</TableHead>
              <TableHead>{t("equipmentReg.colNextInspection")}</TableHead>
              <TableHead className="text-end">{t("equipmentReg.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center"><div className="flex flex-col items-center gap-2 text-muted-foreground"><Truck className="size-6" /><span>{t("equipmentReg.empty")}</span></div></TableCell></TableRow>
            ) : filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell dir="ltr" className="font-mono text-xs font-semibold">{item.fleetNo || "-"}</TableCell>
                <TableCell dir="ltr" className="font-mono text-xs">{item.plateNumber ? <Badge variant="outline" className="font-mono">{item.plateNumber}</Badge> : "-"}</TableCell>
                <TableCell>{typeLabelMap[item.equipmentType] || item.equipmentType}</TableCell>
                <TableCell><Badge variant={opStatusVariant(item.operationalStatus)}>{operationalStatusLabels[item.operationalStatus] || item.operationalStatus}</Badge></TableCell>
                <TableCell>{item.location || "-"}</TableCell>
                <TableCell dir="ltr" className="font-mono text-xs">{item.nextInspectionDate || "-"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="icon" aria-label={t("equipmentReg.view")}>
                      <Link href={`/equipment/${item.id}`}><Eye /></Link>
                    </Button>
                    <EquipmentDialog item={item} typeOptions={typeOptions} />
                    <DeleteEquipmentButton item={item} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
