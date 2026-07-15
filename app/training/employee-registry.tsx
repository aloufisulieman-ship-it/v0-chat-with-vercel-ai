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

export type EmployeeRecord = {
  id: number
  employeeId: string
  name: string
  designation: string
  cardCode: string | null
  active: boolean
}

type EmployeeAction = (formData: FormData) => Promise<void>

function EmployeeDialog({ employee }: { employee?: EmployeeRecord }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(employee?.active ?? true)
  const action: EmployeeAction = employee ? updateEmployee : createEmployee
  const [, formAction, pending] = useActionState(async (_: null, formData: FormData) => {
    await action(formData)
    setOpen(false)
    return null
  }, null)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {employee ? (
          <Button variant="ghost" size="icon" aria-label={`تعديل ${employee.name}`}><Pencil /></Button>
        ) : (
          <Button><Plus data-icon="inline-start" />إضافة موظف</Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{employee ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</DialogTitle>
          <DialogDescription>أدخل البيانات المرجعية التي ستظهر تلقائياً في قوائم حضور Toolbox Talk.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {employee && <input type="hidden" name="id" value={employee.id} />}
          <input type="hidden" name="active" value={String(active)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2"><Label htmlFor={`employee-id-${employee?.id ?? "new"}`}>الرقم الوظيفي</Label><Input id={`employee-id-${employee?.id ?? "new"}`} name="employeeId" defaultValue={employee?.employeeId} required /></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`employee-name-${employee?.id ?? "new"}`}>الاسم</Label><Input id={`employee-name-${employee?.id ?? "new"}`} name="name" defaultValue={employee?.name} required /></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`employee-job-${employee?.id ?? "new"}`}>المسمى الوظيفي</Label><Input id={`employee-job-${employee?.id ?? "new"}`} name="designation" defaultValue={employee?.designation} required /></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`employee-card-${employee?.id ?? "new"}`}>رقم البطاقة/الكود</Label><Input id={`employee-card-${employee?.id ?? "new"}`} name="cardCode" defaultValue={employee?.cardCode ?? ""} /></div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col gap-1"><Label htmlFor={`employee-active-${employee?.id ?? "new"}`}>الحالة</Label><span className="text-sm text-muted-foreground">الموظف النشط يظهر في قوائم اختيار الحضور.</span></div>
            <Switch id={`employee-active-${employee?.id ?? "new"}`} checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter><Button type="submit" disabled={pending}>{pending ? "جارٍ الحفظ..." : "حفظ"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteEmployeeButton({ employee }: { employee: EmployeeRecord }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={`حذف ${employee.name}`}><Trash2 /></Button></AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader><AlertDialogTitle>حذف الموظف؟</AlertDialogTitle><AlertDialogDescription>سيُحذف {employee.name} من السجل المرجعي فقط، ولن تتأثر جلسات الحضور المحفوظة سابقاً.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <form action={deleteEmployee}><input type="hidden" name="id" value={employee.id} /><AlertDialogAction type="submit">تأكيد الحذف</AlertDialogAction></form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function EmployeeRegistry({ employees }: { employees: EmployeeRecord[] }) {
  return (
    <section className="flex flex-col gap-4" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-semibold text-foreground">سجل الموظفين</h2><p className="text-sm text-muted-foreground">قاعدة مرجعية لاختيار الحضور وتعبئة بياناتهم تلقائياً.</p></div>
        <EmployeeDialog />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>الرقم الوظيفي</TableHead><TableHead>الاسم</TableHead><TableHead>المسمى الوظيفي</TableHead><TableHead>البطاقة/الكود</TableHead><TableHead>الحالة</TableHead><TableHead className="text-left">إجراءات</TableHead></TableRow></TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-32 text-center"><div className="flex flex-col items-center gap-2 text-muted-foreground"><UserRound className="size-6" /><span>لا يوجد موظفون. أضف أول موظف للبدء.</span></div></TableCell></TableRow>
            ) : employees.map((employee) => (
              <TableRow key={employee.id}><TableCell dir="ltr" className="font-mono text-xs">{employee.employeeId}</TableCell><TableCell className="font-medium">{employee.name}</TableCell><TableCell>{employee.designation}</TableCell><TableCell dir="ltr">{employee.cardCode || "-"}</TableCell><TableCell><Badge variant={employee.active ? "default" : "secondary"}>{employee.active ? "نشط" : "غير نشط"}</Badge></TableCell><TableCell><div className="flex justify-end gap-1"><EmployeeDialog employee={employee} /><DeleteEmployeeButton employee={employee} /></div></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
