"use client"

import { useActionState, useState } from "react"
import { Pencil, Plus, Trash2, UserRound } from "lucide-react"
import { createEmployee, deleteEmployee, updateEmployee } from "@/app/actions/hse"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useI18n } from "@/lib/i18n/client"

export type EmployeeRecord = {
  id: number
  employeeId: string
  name: string
  designation: string
  department: string
  company: string
  nationality: string
  profileStatus: string
  cardCode: string | null
  uniformNumber: string | null
  phone: string | null
  photoUrl: string | null
  active: boolean
}

type EmployeeAction = (formData: FormData) => Promise<void>

function EmployeeDialog({ employee }: { employee?: EmployeeRecord }) {
  const { t, dir } = useI18n()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(employee?.active ?? true)
  const [photo, setPhoto] = useState(employee?.photoUrl ?? "")
  const action: EmployeeAction = employee ? updateEmployee : createEmployee

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result || ""))
    reader.readAsDataURL(file)
  }
  const [, formAction, pending] = useActionState(async (_: null, formData: FormData) => {
    await action(formData)
    setOpen(false)
    return null
  }, null)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {employee ? (
          <Button variant="ghost" size="icon" aria-label={t("employeeReg.editAria").replace("{name}", employee.name)}><Pencil /></Button>
        ) : (
          <Button><Plus data-icon="inline-start" />{t("employeeReg.addEmployee")}</Button>
        )}
      </DialogTrigger>
      <DialogContent dir={dir}>
        <DialogHeader>
          <DialogTitle>{employee ? t("employeeReg.dialogEditTitle") : t("employeeReg.dialogAddTitle")}</DialogTitle>
          <DialogDescription>{t("employeeReg.dialogDesc")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {employee && <input type="hidden" name="id" value={employee.id} />}
          <input type="hidden" name="active" value={String(active)} />
          <input type="hidden" name="photoUrl" value={photo} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2"><Label htmlFor={`employee-id-${employee?.id ?? "new"}`}>{t("employeeReg.fEmployeeId")}</Label><Input id={`employee-id-${employee?.id ?? "new"}`} name="employeeId" defaultValue={employee?.employeeId} required /></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`employee-name-${employee?.id ?? "new"}`}>{t("employeeReg.fName")}</Label><Input id={`employee-name-${employee?.id ?? "new"}`} name="name" defaultValue={employee?.name} required /></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`employee-job-${employee?.id ?? "new"}`}>{t("employeeReg.fDesignation")}</Label><Input id={`employee-job-${employee?.id ?? "new"}`} name="designation" defaultValue={employee?.designation} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`employee-department-${employee?.id ?? "new"}`}>{t("employeeReg.fDepartment")}</Label><Input id={`employee-department-${employee?.id ?? "new"}`} name="department" defaultValue={employee?.department} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`employee-company-${employee?.id ?? "new"}`}>{t("employeeReg.fCompany")}</Label><Input id={`employee-company-${employee?.id ?? "new"}`} name="company" defaultValue={employee?.company || "MHS"} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`employee-nationality-${employee?.id ?? "new"}`}>{t("employeeReg.fNationality")}</Label><Input id={`employee-nationality-${employee?.id ?? "new"}`} name="nationality" defaultValue={employee?.nationality} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`employee-card-${employee?.id ?? "new"}`}>{t("employeeReg.fCardCode")}</Label><Input id={`employee-card-${employee?.id ?? "new"}`} name="cardCode" defaultValue={employee?.cardCode ?? ""} /></div>
            <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor={`employee-uniform-${employee?.id ?? "new"}`}>{t("employeeReg.fUniformNumber")}</Label><Input id={`employee-uniform-${employee?.id ?? "new"}`} name="uniformNumber" defaultValue={employee?.uniformNumber ?? ""} placeholder={t("employeeReg.fUniformPlaceholder")} dir="ltr" inputMode="numeric" /><span className="text-xs text-muted-foreground">{t("employeeReg.fUniformHint")}</span></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`employee-phone-${employee?.id ?? "new"}`}>{t("employeeReg.fPhone")}</Label><Input id={`employee-phone-${employee?.id ?? "new"}`} name="phone" defaultValue={employee?.phone ?? ""} dir="ltr" inputMode="tel" /></div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`employee-photo-${employee?.id ?? "new"}`}>{t("employeeReg.fPhotoUrl")}</Label>
              <div className="flex items-center gap-3">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo || "/placeholder.svg"} alt={t("employeeReg.fPhotoUrl")} className="size-12 rounded-full border border-border object-cover" />
                ) : (
                  <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"><UserRound className="size-5" /></span>
                )}
                <div className="flex flex-col gap-1">
                  <Input id={`employee-photo-${employee?.id ?? "new"}`} type="file" accept="image/*" onChange={onPhotoChange} className="text-xs" />
                  {photo && <button type="button" onClick={() => setPhoto("")} className="text-start text-xs text-destructive">{t("employeeReg.fPhotoRemove")}</button>}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{t("employeeReg.fPhotoHint")}</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col gap-1"><Label htmlFor={`employee-active-${employee?.id ?? "new"}`}>{t("employeeReg.fStatus")}</Label><span className="text-sm text-muted-foreground">{t("employeeReg.activeHint")}</span></div>
            <Switch id={`employee-active-${employee?.id ?? "new"}`} checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter><Button type="submit" disabled={pending}>{pending ? t("employeeReg.saving") : t("employeeReg.save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteEmployeeButton({ employee }: { employee: EmployeeRecord }) {
  const { t, dir } = useI18n()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={t("employeeReg.deleteAria").replace("{name}", employee.name)}><Trash2 /></Button></AlertDialogTrigger>
      <AlertDialogContent dir={dir}>
        <AlertDialogHeader><AlertDialogTitle>{t("employeeReg.deleteTitle")}</AlertDialogTitle><AlertDialogDescription>{t("employeeReg.deleteDesc").replace("{name}", employee.name)}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("employeeReg.cancel")}</AlertDialogCancel>
          <form action={deleteEmployee}><input type="hidden" name="id" value={employee.id} /><AlertDialogAction type="submit">{t("employeeReg.confirmDelete")}</AlertDialogAction></form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function EmployeeRegistry({ employees }: { employees: EmployeeRecord[] }) {
  const { t, dir } = useI18n()
  return (
    <section className="flex flex-col gap-4" dir={dir}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-semibold text-foreground">{t("employeeReg.heading")}</h2><p className="text-sm text-muted-foreground">{t("employeeReg.subtitle")}</p></div>
        <EmployeeDialog />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>{t("employeeReg.colEmployeeId")}</TableHead><TableHead>{t("employeeReg.colName")}</TableHead><TableHead>{t("employeeReg.colUniform")}</TableHead><TableHead>{t("employeeReg.colDesignation")}</TableHead><TableHead>{t("employeeReg.colDepartment")}</TableHead><TableHead>{t("employeeReg.colCompany")}</TableHead><TableHead>{t("employeeReg.colProfileStatus")}</TableHead><TableHead>{t("employeeReg.colStatus")}</TableHead><TableHead className="text-end">{t("employeeReg.colActions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="h-32 text-center"><div className="flex flex-col items-center gap-2 text-muted-foreground"><UserRound className="size-6" /><span>{t("employeeReg.empty")}</span></div></TableCell></TableRow>
            ) : employees.map((employee) => (
              <TableRow key={employee.id}><TableCell dir="ltr" className="font-mono text-xs">{employee.employeeId}</TableCell><TableCell className="font-medium">{employee.name}</TableCell><TableCell dir="ltr" className="font-mono text-xs">{employee.uniformNumber ? <Badge variant="outline" className="font-mono">{employee.uniformNumber}</Badge> : <span className="text-muted-foreground">-</span>}</TableCell><TableCell>{employee.designation || "-"}</TableCell><TableCell>{employee.department || "-"}</TableCell><TableCell>{employee.company || "MHS"}</TableCell><TableCell><Badge variant={employee.profileStatus === "complete" ? "outline" : "destructive"}>{employee.profileStatus === "complete" ? t("employeeReg.statusComplete") : t("employeeReg.statusIncomplete")}</Badge></TableCell><TableCell><Badge variant={employee.active ? "default" : "secondary"}>{employee.active ? t("employeeReg.statusActive") : t("employeeReg.statusInactive")}</Badge></TableCell><TableCell><div className="flex justify-end gap-1"><EmployeeDialog employee={employee} /><DeleteEmployeeButton employee={employee} /></div></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
