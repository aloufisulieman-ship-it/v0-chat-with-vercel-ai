"use client"

import { useState, useTransition } from "react"
import { Lock, Loader2, MailCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { requestSettingsUnlock } from "@/app/actions/org-settings"
import { useI18n } from "@/lib/i18n/client"

// لافتة القفل المشتركة لقسمَي "معلومات المنشأة" و"إعدادات التشغيل" في صفحة الإعدادات.
// تظهر لمدير المؤسسة فقط بعد القفل (لا تُعرض لمسؤول المنصّة لأنه يتجاوز القفل). زر
// "طلب فتح التعديل" يرسل الطلب لإدارة المنصّة ولا يفتح القفل مباشرة.
export function SettingsLockNotice({ unlockRequested }: { unlockRequested: boolean }) {
  const { t } = useI18n()
  const [pending, start] = useTransition()
  const [requested, setRequested] = useState(unlockRequested)

  function request() {
    start(async () => {
      const res = await requestSettingsUnlock()
      if (res.ok) {
        setRequested(true)
        toast.success(t("settingsPage.lockRequestSent"))
      } else {
        toast.error(res.error || t("settingsPage.lockRequestFailed"))
      }
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-accent/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
          <Lock className="size-4" />
        </span>
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold text-foreground">{t("settingsPage.lockTitle")}</h4>
          <p className="max-w-2xl text-xs text-muted-foreground text-pretty">{t("settingsPage.lockBody")}</p>
        </div>
      </div>
      <div className="shrink-0 sm:pe-1">
        {requested ? (
          <span className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
            <MailCheck className="size-4" />
            {t("settingsPage.lockRequestSent")}
          </span>
        ) : (
          <Button onClick={request} disabled={pending} variant="outline" size="sm" className="gap-2 bg-transparent">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {pending ? t("settingsPage.lockRequesting") : t("settingsPage.lockRequestUnlock")}
          </Button>
        )}
      </div>
    </div>
  )
}
