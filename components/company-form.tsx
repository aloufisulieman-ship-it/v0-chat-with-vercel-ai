"use client"

import { useState, useTransition } from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveCompany } from "@/app/actions/hse"

type Company = {
  name: string
  industry: string | null
  address: string | null
  phone: string | null
  email: string | null
  employeeCount: number | null
  hseManager: string | null
} | null

export function CompanyForm({ company }: { company: Company }) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveCompany(formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">اسم المنشأة</Label>
        <Input id="name" name="name" defaultValue={company?.name ?? ""} placeholder="مثال: شركة الصناعات المتكاملة" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="industry">القطاع / النشاط</Label>
        <Input id="industry" name="industry" defaultValue={company?.industry ?? ""} placeholder="مثال: تصنيع" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="address">العنوان</Label>
        <Input id="address" name="address" defaultValue={company?.address ?? ""} placeholder="المدينة - المنطقة" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">رقم الهاتف</Label>
          <Input id="phone" name="phone" defaultValue={company?.phone ?? ""} dir="ltr" placeholder="+966..." />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" name="email" type="email" defaultValue={company?.email ?? ""} dir="ltr" placeholder="info@company.com" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="employeeCount">عدد الموظفين</Label>
          <Input id="employeeCount" name="employeeCount" type="number" min="0" defaultValue={company?.employeeCount ?? 0} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hseManager">مدير السلامة (HSE)</Label>
          <Input id="hseManager" name="hseManager" defaultValue={company?.hseManager ?? ""} placeholder="الاسم" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" className="gap-2" disabled={isPending}>
          <Save className="size-4" />
          {isPending ? "جارٍ الحفظ..." : "حفظ معلومات المنشأة"}
        </Button>
        {saved && <span className="text-sm text-primary">تم الحفظ بنجاح</span>}
      </div>
    </form>
  )
}
