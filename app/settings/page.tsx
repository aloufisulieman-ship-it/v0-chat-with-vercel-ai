import Link from "next/link"
import { Building2, Users, ShieldCheck, ArrowLeft, UserCircle, KeyRound } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CompanyForm } from "@/components/company-form"
import { ChangePasswordForm } from "@/components/change-password-form"
import { requireOrgUser } from "@/lib/session"
import { getCompany } from "@/app/actions/hse"
import { getUsers } from "@/app/actions/users"
import { getServerT } from "@/lib/i18n/server"
import type { TFunction } from "@/lib/i18n/translate"

const roleKeys: Record<string, string> = {
  admin: "usersManager.roleAdmin",
  manager: "usersManager.roleManager",
  user: "usersManager.roleUser",
}

const statusMeta: Record<string, { key: string; cls: string }> = {
  approved: { key: "usersManager.statusApproved", cls: "bg-primary/10 text-primary" },
  pending: { key: "usersManager.statusPending", cls: "bg-accent/15 text-accent-foreground" },
  rejected: { key: "usersManager.statusRejected", cls: "bg-destructive/10 text-destructive" },
}

function roleLabel(t: TFunction, role?: string | null): string {
  return t(roleKeys[role ?? "user"] ?? "usersManager.roleUser")
}

export default async function SettingsPage() {
  const user = await requireOrgUser()
  const company = await getCompany()
  const isAdmin = user.role === "admin"
  const team = isAdmin ? await getUsers() : []
  const { t } = await getServerT()

  return (
    <AppShell title={t("pageHeaders.settingsTitle")} subtitle={t("pageHeaders.settingsSubtitle")} user={user}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">{t("settingsPage.facilityInfo")}</h3>
          </div>
          <CompanyForm company={company} readOnly={user.impersonating} />
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2">
            <UserCircle className="size-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">{t("settingsPage.myAccount")}</h3>
          </div>
          <div className="flex flex-col gap-3">
            <Row label={t("settingsPage.accountName")} value={user.name} />
            <Row label={t("settingsPage.accountEmail")} value={user.email} ltr />
            <Row label={t("settingsPage.accountRole")} value={roleLabel(t, user.role)} />
          </div>
          <div className="mt-auto rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground text-pretty">
            {t("settingsPage.roleHint")}
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">{t("settingsPage.changePassword")}</h3>
          </div>
          <div className="max-w-md">
            <ChangePasswordForm />
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">{t("settingsPage.teamAndPerms")}</h3>
            </div>
            {isAdmin && (
              <Button asChild variant="outline" size="sm" className="gap-2 bg-transparent">
                <Link href="/users">
                  {t("settingsPage.manageUsers")}
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            )}
          </div>

          {!isAdmin ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("settingsPage.adminOnlyTeam")}
            </p>
          ) : team.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("settingsPage.noMembers")}</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {team.map((m) => {
                const st = statusMeta[m.status ?? "pending"] ?? statusMeta.pending
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {m.name.slice(0, 1)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {m.name}
                          {m.id === user.id && (
                            <span className="mr-1 text-xs text-muted-foreground"> {t("settingsPage.you")}</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground" dir="ltr">{m.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{t(st.key)}</span>
                      <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                        <ShieldCheck className="size-3.5 text-primary" />
                        {roleLabel(t, m.role)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground" dir={ltr ? "ltr" : undefined}>{value}</span>
    </div>
  )
}
