"use client"

import { useActionState, useState } from "react"
import { Pencil, Plus, Trash2, ShieldAlert } from "lucide-react"
import { createSafetyRule, deleteSafetyRule, updateSafetyRule } from "@/app/actions/equipment"
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
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useI18n } from "@/lib/i18n/client"

export type SafetyRuleRecord = {
  id: number
  location: string
  rules: string
  active: boolean
}

type RuleAction = (formData: FormData) => Promise<void>

function RuleDialog({ item }: { item?: SafetyRuleRecord }) {
  const { t, dir } = useI18n()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(item?.active ?? true)
  const action: RuleAction = item ? updateSafetyRule : createSafetyRule
  const [, formAction, pending] = useActionState(async (_: null, formData: FormData) => {
    await action(formData)
    setOpen(false)
    return null
  }, null)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="icon" aria-label={t("safetyRules.editAria").replace("{location}", item.location)}><Pencil /></Button>
        ) : (
          <Button><Plus data-icon="inline-start" />{t("safetyRules.addRule")}</Button>
        )}
      </DialogTrigger>
      <DialogContent dir={dir}>
        <DialogHeader>
          <DialogTitle>{item ? t("safetyRules.dialogEditTitle") : t("safetyRules.dialogAddTitle")}</DialogTitle>
          <DialogDescription>{t("safetyRules.dialogDesc")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {item && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="active" value={String(active)} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`sr-location-${item?.id ?? "new"}`}>{t("safetyRules.fLocation")}</Label>
            <Input id={`sr-location-${item?.id ?? "new"}`} name="location" defaultValue={item?.location} required placeholder={t("safetyRules.fLocationPlaceholder")} />
            <span className="text-xs text-muted-foreground">{t("safetyRules.fLocationHint")}</span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`sr-rules-${item?.id ?? "new"}`}>{t("safetyRules.fRules")}</Label>
            <Textarea id={`sr-rules-${item?.id ?? "new"}`} name="rules" defaultValue={item?.rules} rows={7} placeholder={t("safetyRules.fRulesPlaceholder")} />
            <span className="text-xs text-muted-foreground">{t("safetyRules.fRulesHint")}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`sr-active-${item?.id ?? "new"}`}>{t("safetyRules.fStatus")}</Label>
              <span className="text-sm text-muted-foreground">{t("safetyRules.activeHint")}</span>
            </div>
            <Switch id={`sr-active-${item?.id ?? "new"}`} checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter><Button type="submit" disabled={pending}>{pending ? t("safetyRules.saving") : t("safetyRules.save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteRuleButton({ item }: { item: SafetyRuleRecord }) {
  const { t, dir } = useI18n()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={t("safetyRules.deleteAria").replace("{location}", item.location)}><Trash2 /></Button></AlertDialogTrigger>
      <AlertDialogContent dir={dir}>
        <AlertDialogHeader><AlertDialogTitle>{t("safetyRules.deleteTitle")}</AlertDialogTitle><AlertDialogDescription>{t("safetyRules.deleteDesc").replace("{location}", item.location)}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("safetyRules.cancel")}</AlertDialogCancel>
          <form action={deleteSafetyRule}><input type="hidden" name="id" value={item.id} /><AlertDialogAction type="submit">{t("safetyRules.confirmDelete")}</AlertDialogAction></form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function SafetyRulesRegistry({ items }: { items: SafetyRuleRecord[] }) {
  const { t, dir } = useI18n()
  return (
    <section className="flex flex-col gap-4" dir={dir}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-semibold text-foreground">{t("safetyRules.heading")}</h2><p className="text-sm text-muted-foreground">{t("safetyRules.subtitle")}</p></div>
        <RuleDialog />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>{t("safetyRules.colLocation")}</TableHead><TableHead>{t("safetyRules.colRules")}</TableHead><TableHead>{t("safetyRules.colStatus")}</TableHead><TableHead className="text-end">{t("safetyRules.colActions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-32 text-center"><div className="flex flex-col items-center gap-2 text-muted-foreground"><ShieldAlert className="size-6" /><span>{t("safetyRules.empty")}</span></div></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id}><TableCell className="font-medium align-top">{item.location}</TableCell><TableCell className="max-w-md align-top"><p className="whitespace-pre-line text-sm text-muted-foreground line-clamp-4">{item.rules || "-"}</p></TableCell><TableCell className="align-top"><Badge variant={item.active ? "default" : "secondary"}>{item.active ? t("safetyRules.statusActive") : t("safetyRules.statusInactive")}</Badge></TableCell><TableCell className="align-top"><div className="flex justify-end gap-1"><RuleDialog item={item} /><DeleteRuleButton item={item} /></div></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
