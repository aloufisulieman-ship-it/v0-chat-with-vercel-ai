"use client"

import { useActionState, useState } from "react"
import { Pencil, Plus, Trash2, Truck } from "lucide-react"
import { createEquipment, deleteEquipment, updateEquipment } from "@/app/actions/equipment"
import { equipmentTypeOptions, equipmentTypeLabels } from "@/lib/labels"
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
  plateNumber: string
  equipmentType: string
  ownerCompany: string
  driverName: string
  internalCode: string
  active: boolean
  notes: string
}

type EquipmentAction = (formData: FormData) => Promise<void>

function EquipmentDialog({ item }: { item?: EquipmentRecord }) {
  const { t, dir } = useI18n()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(item?.active ?? true)
  const [type, setType] = useState(item?.equipmentType ?? "forklift")
  const action: EquipmentAction = item ? updateEquipment : createEquipment
  const [, formAction, pending] = useActionState(async (_: null, formData: FormData) => {
    await action(formData)
    setOpen(false)
    return null
  }, null)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="icon" aria-label={t("equipmentReg.editAria").replace("{plate}", item.plateNumber)}><Pencil /></Button>
        ) : (
          <Button><Plus data-icon="inline-start" />{t("equipmentReg.addEquipment")}</Button>
        )}
      </DialogTrigger>
      <DialogContent dir={dir}>
        <DialogHeader>
          <DialogTitle>{item ? t("equipmentReg.dialogEditTitle") : t("equipmentReg.dialogAddTitle")}</DialogTitle>
          <DialogDescription>{t("equipmentReg.dialogDesc")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {item && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="active" value={String(active)} />
          <input type="hidden" name="equipmentType" value={type} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`eq-plate-${item?.id ?? "new"}`}>{t("equipmentReg.fPlate")}</Label>
              <Input id={`eq-plate-${item?.id ?? "new"}`} name="plateNumber" defaultValue={item?.plateNumber} required dir="ltr" placeholder={t("equipmentReg.fPlatePlaceholder")} />
              <span className="text-xs text-muted-foreground">{t("equipmentReg.fPlateHint")}</span>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("equipmentReg.fType")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {equipmentTypeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`eq-owner-${item?.id ?? "new"}`}>{t("equipmentReg.fOwner")}</Label>
              <Input id={`eq-owner-${item?.id ?? "new"}`} name="ownerCompany" defaultValue={item?.ownerCompany} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`eq-driver-${item?.id ?? "new"}`}>{t("equipmentReg.fDriver")}</Label>
              <Input id={`eq-driver-${item?.id ?? "new"}`} name="driverName" defaultValue={item?.driverName} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`eq-code-${item?.id ?? "new"}`}>{t("equipmentReg.fInternalCode")}</Label>
              <Input id={`eq-code-${item?.id ?? "new"}`} name="internalCode" defaultValue={item?.internalCode} dir="ltr" />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor={`eq-notes-${item?.id ?? "new"}`}>{t("equipmentReg.fNotes")}</Label>
              <Input id={`eq-notes-${item?.id ?? "new"}`} name="notes" defaultValue={item?.notes} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`eq-active-${item?.id ?? "new"}`}>{t("equipmentReg.fStatus")}</Label>
              <span className="text-sm text-muted-foreground">{t("equipmentReg.activeHint")}</span>
            </div>
            <Switch id={`eq-active-${item?.id ?? "new"}`} checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter><Button type="submit" disabled={pending}>{pending ? t("equipmentReg.saving") : t("equipmentReg.save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteEquipmentButton({ item }: { item: EquipmentRecord }) {
  const { t, dir } = useI18n()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={t("equipmentReg.deleteAria").replace("{plate}", item.plateNumber)}><Trash2 /></Button></AlertDialogTrigger>
      <AlertDialogContent dir={dir}>
        <AlertDialogHeader><AlertDialogTitle>{t("equipmentReg.deleteTitle")}</AlertDialogTitle><AlertDialogDescription>{t("equipmentReg.deleteDesc").replace("{plate}", item.plateNumber)}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("equipmentReg.cancel")}</AlertDialogCancel>
          <form action={deleteEquipment}><input type="hidden" name="id" value={item.id} /><AlertDialogAction type="submit">{t("equipmentReg.confirmDelete")}</AlertDialogAction></form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function EquipmentRegistry({ items }: { items: EquipmentRecord[] }) {
  const { t, dir } = useI18n()
  return (
    <section className="flex flex-col gap-4" dir={dir}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-semibold text-foreground">{t("equipmentReg.heading")}</h2><p className="text-sm text-muted-foreground">{t("equipmentReg.subtitle")}</p></div>
        <EquipmentDialog />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>{t("equipmentReg.colPlate")}</TableHead><TableHead>{t("equipmentReg.colType")}</TableHead><TableHead>{t("equipmentReg.colOwner")}</TableHead><TableHead>{t("equipmentReg.colDriver")}</TableHead><TableHead>{t("equipmentReg.colCode")}</TableHead><TableHead>{t("equipmentReg.colStatus")}</TableHead><TableHead className="text-end">{t("equipmentReg.colActions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center"><div className="flex flex-col items-center gap-2 text-muted-foreground"><Truck className="size-6" /><span>{t("equipmentReg.empty")}</span></div></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id}><TableCell dir="ltr" className="font-mono text-xs"><Badge variant="outline" className="font-mono">{item.plateNumber}</Badge></TableCell><TableCell>{equipmentTypeLabels[item.equipmentType] || item.equipmentType}</TableCell><TableCell>{item.ownerCompany || "-"}</TableCell><TableCell>{item.driverName || "-"}</TableCell><TableCell dir="ltr" className="font-mono text-xs">{item.internalCode || "-"}</TableCell><TableCell><Badge variant={item.active ? "default" : "secondary"}>{item.active ? t("equipmentReg.statusActive") : t("equipmentReg.statusInactive")}</Badge></TableCell><TableCell><div className="flex justify-end gap-1"><EquipmentDialog item={item} /><DeleteEquipmentButton item={item} /></div></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
