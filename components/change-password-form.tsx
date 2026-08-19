"use client"

import { useState } from "react"
import { Loader2, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"

export function ChangePasswordForm() {
  const { t } = useI18n()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 8) {
      toast({ title: t("changePassword.tooShortTitle"), description: t("changePassword.tooShortDesc"), variant: "destructive" })
      return
    }
    if (next !== confirm) {
      toast({ title: t("changePassword.mismatchTitle"), description: t("changePassword.mismatchDesc"), variant: "destructive" })
      return
    }
    setLoading(true)
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    })
    setLoading(false)
    if (error) {
      toast({
        title: t("changePassword.failedTitle"),
        description: error.message === "Invalid password" ? t("changePassword.wrongCurrent") : t("changePassword.genericError"),
        variant: "destructive",
      })
      return
    }
    toast({ title: t("changePassword.successTitle"), description: t("changePassword.successDesc") })
    setCurrent("")
    setNext("")
    setConfirm("")
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="cp-current">{t("changePassword.currentLabel")}</Label>
        <Input
          id="cp-current"
          type="password"
          dir="ltr"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cp-new">{t("changePassword.newLabel")}</Label>
        <Input
          id="cp-new"
          type="password"
          dir="ltr"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={t("changePassword.newPlaceholder")}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cp-confirm">{t("changePassword.confirmLabel")}</Label>
        <Input
          id="cp-confirm"
          type="password"
          dir="ltr"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={loading} className="gap-2 self-start">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        {t("changePassword.submit")}
      </Button>
    </form>
  )
}
