"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { markNotificationsRead } from "@/app/actions/lifecycle"
import { lifecycleUi, type Dept } from "@/lib/lifecycle"

type L = "ar" | "en"

export type InboxItem = {
  id: number
  module: string
  recordId: number
  title: string
  message: string
  read: boolean
  createdAt: Date | string
}

// صندوق «المحال إلى جهتي» في لوحات HR/المالية: الإشعارات الداخلية غير المقروءة
// الناتجة عن الإحالات، مع زر تحديد الكل كمقروء ورابط للسجل في سجلّه العام.
export function DeptInbox({ dept, items, locale = "ar" }: { dept: Dept; items: InboxItem[]; locale?: L }) {
  const s = lifecycleUi(locale)
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const unread = items.filter((i) => !i.read)
  const en = locale === "en"

  async function markAll() {
    setBusy(true)
    try {
      await markNotificationsRead(dept)
      router.refresh()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const fmt = new Intl.DateTimeFormat(en ? "en-GB" : "ar-SA", { dateStyle: "medium", timeStyle: "short" })

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Bell className="size-4 text-primary" aria-hidden />
          {s.referredToMe}
          {unread.length > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {unread.length}
            </span>
          )}
        </h2>
        {unread.length > 0 && (
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={markAll} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {en ? "Mark all as read" : "تحديد الكل كمقروء"}
          </Button>
        )}
      </header>
      {unread.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-muted-foreground">
          {en ? "No new referrals." : "لا توجد إحالات جديدة."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {unread.slice(0, 10).map((n) => (
            <li key={n.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{n.title}</span>
                {n.message && <span className="text-xs text-muted-foreground">{n.message}</span>}
                <span className="text-xs text-muted-foreground">{fmt.format(new Date(n.createdAt))}</span>
              </div>
              <Button asChild size="sm" variant="outline" className="bg-transparent">
                <Link href={`/${n.module}?status=referred&dept=${dept}`}>{en ? "Open" : "فتح"}</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
