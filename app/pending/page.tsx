import { redirect } from "next/navigation"
import { Clock, ShieldCheck } from "lucide-react"
import { getCurrentUser } from "@/lib/session"
import { Card } from "@/components/ui/card"
import { SignOutButton } from "@/components/sign-out-button"
import { getServerT } from "@/lib/i18n/server"

export default async function PendingPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  // مسؤول المنصّة لا ينتمي لمؤسسة — يُوجَّه دائماً إلى لوحة تحكّم المنصّة.
  if (user.isPlatformAdmin) redirect("/admin/organizations")
  if (user.status === "approved") redirect("/")

  const rejected = user.status === "rejected"
  const { t } = await getServerT()
  const pendingBody = t("pendingPage.pendingBody").replace("{name}", user.name)

  return (
    <main className="min-h-svh bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-7" />
        </div>

        {rejected ? (
          <>
            <h1 className="text-xl font-semibold text-foreground text-balance">{t("pendingPage.rejectedTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              {t("pendingPage.rejectedBody")}
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Clock className="size-5" />
            </div>
            <h1 className="text-xl font-semibold text-foreground text-balance">{t("pendingPage.pendingTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">{pendingBody}</p>
          </>
        )}

        <div className="mt-6">
          <SignOutButton />
        </div>
      </Card>
    </main>
  )
}
