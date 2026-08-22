import type { ReactNode } from "react"
import { ShieldHalf } from "lucide-react"
import { requirePlatformAdmin } from "@/lib/session"
import { SignOutButton } from "@/components/sign-out-button"
import { LanguageSwitcher } from "@/components/language-switcher"

// تخطيط قسم مسؤول المنصّة — محميّ بدور platform_admin حصراً، وبمظهر مميّز (لوحة تحكّم
// عابرة للمؤسسات) يختلف عن مساحة المؤسسة العادية.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requirePlatformAdmin()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldHalf className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-tight text-foreground">لوحة تحكّم المنصّة</span>
              <span className="text-xs text-muted-foreground">{admin.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  )
}
