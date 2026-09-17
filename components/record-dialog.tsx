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
import { useI18n } from "@/lib/i18n/client"
import { useIsAuditor } from "@/components/user-role-context"

export interface FieldDef {
  name: string
  label: string
  type?: "text" | "number" | "date" | "textarea" | "select"
  required?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
  defaultValue?: string | number
  min?: number
  max?: number
  full?: boolean
}

export function RecordDialog({
  title,
  description,
  triggerLabel,
  fields,
  action,
  trigger,
  hiddenFields,
  allowAuditor = false,
}: {
  title: string
  description?: string
  triggerLabel?: string
  fields: FieldDef[]
  action: (formData: FormData) => Promise<void>
  // زر فتح بديل (مثل أيقونة تعديل داخل صف جدول) بدل زر "إضافة" الافتراضي.
  trigger?: React.ReactNode
  // قيم تُرسَل مع النموذج دون عرضها (مثل معرّف السجل عند التعديل).
  hiddenFields?: Record<string, string | number>
  // يُعرض للمدقق أيضاً: لسجل التدقيق وحده، فهو دفتر ملاحظاته المصرّح له بالكتابة فيه.
  allowAuditor?: boolean
}) {
  const { t } = useI18n()
  const isAuditor = useIsAuditor()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await action(formData)
        toast({ title: t("recordDialog.savedTitle"), description: t("recordDialog.savedDesc") })
        setOpen(false)
      } catch (err) {
        toast({
          title: t("recordDialog.saveFailedTitle"),
          description: err instanceof Error ? err.message : t("recordDialog.saveFailedDesc"),
          variant: "destructive",
        })
      }
    })
  }

  // المدقق لا يُنشئ ولا يعدّل السجلات (عدا سجل التدقيق عبر allowAuditor).
  if (isAuditor && !allowAuditor) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2 self-start sm:self-auto">
            <Plus className="size-4" />
            {triggerLabel ?? t("recordDialog.addNew")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {hiddenFields &&
            Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={String(value)} />
            ))}
          {fields.map((f) => (
            <div key={f.name} className={`flex flex-col gap-2 ${f.full || f.type === "textarea" ? "sm:col-span-2" : ""}`}>
              <Label htmlFor={f.name}>
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
              {f.type === "textarea" ? (
                <Textarea
                  id={f.name}
                  name={f.name}
                  placeholder={f.placeholder}
                  required={f.required}
                  rows={3}
                  defaultValue={f.defaultValue}
                />
              ) : f.type === "select" ? (
                <Select name={f.name} defaultValue={f.defaultValue ? String(f.defaultValue) : f.options?.[0]?.value}>
                  <SelectTrigger id={f.name}>
                    <SelectValue placeholder={t("recordDialog.choose")} />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options?.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={f.name}
                  name={f.name}
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  required={f.required}
                  defaultValue={f.defaultValue}
                  min={f.min}
                  max={f.max}
                  dir={f.type === "number" || f.type === "date" ? "ltr" : undefined}
                />
              )}
            </div>
          ))}
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? t("recordDialog.saving") : t("recordDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
