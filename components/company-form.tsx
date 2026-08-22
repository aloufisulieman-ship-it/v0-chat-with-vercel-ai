"use client"

import { useState, useTransition } from "react"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveCompany } from "@/app/actions/hse"
import { useI18n } from "@/lib/i18n/client"

type Company = {
  name: string
  industry: string | null
  address: string | null
  phone: string | null
  email: string | null
  employeeCount: number | null
  hseManager: string | null
} | null

export function CompanyForm({ company, readOnly = false }: { company: Company; readOnly?: boolean }) {
  const { t } = useI18n()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await saveCompany(formData)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } catch (err) {
        // أثناء عرض مسؤول المنصّة للمؤسسة يرفض الخادم أي تعديل — نعرض رسالة لطيفة بدل تعطّل الصفحة.
        toast.error(err instanceof Error ? err.message : t("companyForm.saveError"))
      }
    })
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("companyForm.name")}</Label>
        <Input id="name" name="name" defaultValue={company?.name ?? ""} placeholder={t("companyForm.namePlaceholder")} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="industry">{t("companyForm.industry")}</Label>
        <Input id="industry" name="industry" defaultValue={company?.industry ?? ""} placeholder={t("companyForm.industryPlaceholder")} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="address">{t("companyForm.address")}</Label>
        <Input id="address" name="address" defaultValue={company?.address ?? ""} placeholder={t("companyForm.addressPlaceholder")} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">{t("companyForm.phone")}</Label>
          <Input id="phone" name="phone" defaultValue={company?.phone ?? ""} dir="ltr" placeholder="+966..." />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("companyForm.email")}</Label>
          <Input id="email" name="email" type="email" defaultValue={company?.email ?? ""} dir="ltr" placeholder="info@company.com" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="employeeCount">{t("companyForm.employeeCount")}</Label>
          <Input id="employeeCount" name="employeeCount" type="number" min="0" defaultValue={company?.employeeCount ?? 0} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hseManager">{t("companyForm.hseManager")}</Label>
          <Input id="hseManager" name="hseManager" defaultValue={company?.hseManager ?? ""} placeholder={t("companyForm.hseManagerPlaceholder")} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" className="gap-2" disabled={isPending || readOnly}>
          <Save className="size-4" />
          {isPending ? t("companyForm.saving") : t("companyForm.save")}
        </Button>
        {saved && <span className="text-sm text-primary">{t("companyForm.savedOk")}</span>}
        {readOnly && <span className="text-sm text-muted-foreground">{t("companyForm.readOnlyHint")}</span>}
      </div>
    </form>
  )
}
