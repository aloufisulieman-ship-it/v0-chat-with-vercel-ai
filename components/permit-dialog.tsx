"use client"

import type React from "react"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { permitTypeOptions, permitStatusOptions, permitTypeExtraFields } from "@/lib/labels"

// نموذج إصدار تصريح عمل مع حقول ديناميكية تتغيّر حسب نوع التصريح المختار.
export function PermitDialog({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState(permitTypeOptions[0].value)
  const [isPending, startTransition] = useTransition()

  const extraFields = permitTypeExtraFields[type] ?? []
  // الإنشائي فقط يحتاج وصف عمل مطوّل (textarea).
  const isConstruction = type === "construction"

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await action(formData)
        toast({ title: "تم الحفظ بنجاح", description: "تم إصدار التصريح وحفظه في قاعدة البيانات." })
        setOpen(false)
      } catch (err) {
        toast({
          title: "تعذّر الحفظ",
          description: err instanceof Error ? err.message : "حدث خطأ غير متوقع.",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 self-start sm:self-auto">
          <Plus className="size-4" />
          إصدار تصريح
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>إصدار تصريح عمل</DialogTitle>
          <DialogDescription>اختر نوع التصريح وأدخل بياناته.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* نوع التصريح — يحدّد الحقول الظاهرة */}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="type">نوع التصريح</Label>
            <Select name="type" value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="اختر..." />
              </SelectTrigger>
              <SelectContent>
                {permitTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* عنوان التصريح */}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="title">
              عنوان التصريح<span className="text-destructive"> *</span>
            </Label>
            <Input id="title" name="title" required placeholder="مثال: أعمال تمديد كهرباء المستودع" />
          </div>

          {/* الحقول العامة */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="location">الموقع</Label>
            <Input id="location" name="location" placeholder="مثال: المستودع الرئيسي" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="requestedBy">الجهة/الشخص المصرّح له</Label>
            <Input id="requestedBy" name="requestedBy" placeholder="مثال: قسم الصيانة" />
          </div>

          {/* الحقول الديناميكية الخاصة بالنوع */}
          {extraFields.map((f) =>
            isConstruction && f.name === "workDescription" ? (
              <div key={f.name} className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor={f.name}>{f.label}</Label>
                <Textarea id={f.name} name={f.name} rows={3} placeholder={f.placeholder} />
              </div>
            ) : (
              <div key={f.name} className="flex flex-col gap-2">
                <Label htmlFor={f.name}>{f.label}</Label>
                <Input id={f.name} name={f.name} placeholder={f.placeholder} />
              </div>
            ),
          )}

          {/* الحالة والصلاحية */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="status">حالة الاعتماد</Label>
            <Select name="status" defaultValue={permitStatusOptions[0].value}>
              <SelectTrigger id="status">
                <SelectValue placeholder="اختر..." />
              </SelectTrigger>
              <SelectContent>
                {permitStatusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden sm:block" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="validFrom">تاريخ الإصدار</Label>
            <Input id="validFrom" name="validFrom" type="date" dir="ltr" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="validTo">تاريخ الانتهاء</Label>
            <Input id="validTo" name="validTo" type="date" dir="ltr" />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
