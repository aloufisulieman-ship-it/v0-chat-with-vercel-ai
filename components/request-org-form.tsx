"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { registerOrganization } from "@/app/actions/auth-register"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { RaqeebLogo } from "@/components/raqeeb-logo"
import { useI18n } from "@/lib/i18n/client"

// نموذج "طلب تسجيل مؤسسة جديدة": ينشئ حساب المدير الأول + مؤسسة جديدة بحالة قيد
// المراجعة، فيظهر الطلب لمسؤول المنصّة في /admin/organizations لاعتماده يدوياً.
// لا يمنح أي وصول قبل الاعتماد (يحجبه requireUser ويوجّهه إلى /pending).
export function RequestOrgForm() {
  const { t } = useI18n()
  const router = useRouter()
  const [name, setName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await authClient.signUp.email({ email, password, name })
    if (error) {
      setLoading(false)
      setError(error.message ?? t("auth.genericError"))
      return
    }
    const provisioned = await registerOrganization({ companyName })
    setLoading(false)
    if (provisioned.error) {
      setError(provisioned.error)
      return
    }
    // الطلب أُنشئ بنجاح؛ الحساب معلّق حتى اعتماد المنصّة — صفحة الانتظار توضّح ذلك.
    router.push("/pending")
    router.refresh()
  }

  return (
    <main className="min-h-svh bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <RaqeebLogo className="mb-4 flex-col gap-3 text-center [&>div]:items-center" />
          <h1 className="text-lg font-semibold text-foreground text-balance">{t("auth.newOrgTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1 text-pretty">{t("auth.newOrgSubtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("auth.adminName")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="companyName">{t("auth.companyName")}</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              autoComplete="organization"
              placeholder={t("auth.newOrgNamePlaceholder")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              dir="ltr"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              dir="ltr"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t("auth.pleaseWait") : t("auth.newOrgSubmit")}
          </Button>
        </form>

        <p className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground leading-relaxed text-pretty">
          {t("auth.newOrgNote")}
        </p>

        <p className="text-sm text-muted-foreground text-center mt-6">
          {t("auth.haveAccount")}{" "}
          <Link href="/sign-in" className="text-foreground font-medium underline-offset-4 hover:underline">
            {t("auth.signInLink")}
          </Link>
        </p>
      </Card>
    </main>
  )
}
