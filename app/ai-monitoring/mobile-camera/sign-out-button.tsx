"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { useI18n } from "@/lib/i18n/client"

export function SignOutButton() {
  const router = useRouter()
  const { t } = useI18n()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">{t("aiMonitoring.cam.signOut")}</span>
    </button>
  )
}
