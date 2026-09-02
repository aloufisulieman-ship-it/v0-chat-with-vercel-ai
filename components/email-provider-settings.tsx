"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Link2, Unlink, Mail, Monitor, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import {
  disconnectEmailAccount,
  setPreferredEmailProvider,
  type EmailAccountsStatus,
  type EmailProviderChoice,
} from "@/app/actions/email-accounts"
import type { EmailLocale } from "@/lib/email-export"

// بند «برنامج البريد المفضّل» في الإعدادات: اختيار الافتراضي (أو «اسأل كل مرة»)،
// وربط/فك ربط حسابات Outlook وGmail. يقرأ ?email=<provider>:<status> بعد عودة OAuth.

const L = {
  ar: {
    title: "برنامج البريد المفضّل",
    hint: "يُستخدم عند إرسال تقارير المخالفات والحوادث بالبريد. الحسابات المرتبطة تُرسل مباشرةً من بريدك الشخصي.",
    ask: "اسأل في كل مرة",
    askDesc: "تُعرض نافذة الاختيار عند كل إرسال.",
    outlook: "Outlook / Microsoft 365",
    gmail: "Gmail",
    device: "تطبيق البريد على الجهاز",
    copy: "نسخ النص وتنزيل المرفق",
    connected: "مرتبط",
    notConnected: "غير مرتبط",
    unconfigured: "غير مُفعَّل من المسؤول",
    comingSoon: "قريباً",
    connect: "ربط الحساب",
    disconnect: "فك الربط",
    default: "الافتراضي",
    setDefault: "اجعله الافتراضي",
    saved: "تم حفظ التفضيل",
    disconnected: "تم فك ربط الحساب",
    connectedToast: "تم ربط الحساب بنجاح",
    errorToast: "تعذّر ربط الحساب",
    unconfiguredToast: "لم يُعدّ المسؤول متغيرات هذا المزوّد بعد",
  },
  en: {
    title: "Preferred mail program",
    hint: "Used when emailing violation and incident reports. Linked accounts send directly from your own mailbox.",
    ask: "Ask every time",
    askDesc: "The picker is shown on every send.",
    outlook: "Outlook / Microsoft 365",
    gmail: "Gmail",
    device: "Mail app on this device",
    copy: "Copy text & download attachment",
    connected: "Connected",
    notConnected: "Not connected",
    unconfigured: "Not enabled by admin",
    comingSoon: "Coming soon",
    connect: "Connect account",
    disconnect: "Disconnect",
    default: "Default",
    setDefault: "Set as default",
    saved: "Preference saved",
    disconnected: "Account disconnected",
    connectedToast: "Account connected successfully",
    errorToast: "Could not connect account",
    unconfiguredToast: "The admin has not configured this provider yet",
  },
}

function openOAuth(provider: "microsoft" | "google") {
  const url = `/api/email-accounts/${provider}/start?return=${encodeURIComponent("/settings")}`
  if (window.self !== window.top) window.open(url, "_blank", "noopener,noreferrer")
  else window.location.href = url
}

export function EmailProviderSettings({ status, locale }: { status: EmailAccountsStatus; locale: EmailLocale }) {
  const s = L[locale]
  const router = useRouter()
  const params = useSearchParams()
  const [busy, setBusy] = useState<string | null>(null)

  // إشعار نتيجة العودة من OAuth ثم تنظيف الرابط.
  useEffect(() => {
    const flag = params.get("email")
    if (!flag) return
    const [, state, reason] = flag.split(":")
    if (state === "connected") toast({ title: s.connectedToast })
    else if (state === "unconfigured") toast({ title: s.unconfiguredToast, variant: "destructive" })
    else if (state === "error") toast({ title: s.errorToast, description: reason ? decodeURIComponent(reason) : undefined, variant: "destructive" })
    router.replace("/settings")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  async function choose(choice: EmailProviderChoice | null) {
    setBusy(`pref:${choice}`)
    try {
      await setPreferredEmailProvider(choice)
      toast({ title: s.saved })
      router.refresh()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  async function disconnect(p: "microsoft" | "google") {
    setBusy(`dc:${p}`)
    try {
      await disconnectEmailAccount(p)
      toast({ title: s.disconnected })
      router.refresh()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const rows: {
    id: EmailProviderChoice | null
    label: string
    desc?: string
    icon: React.ReactNode
    oauth?: "microsoft" | "google"
  }[] = [
    { id: null, label: s.ask, desc: s.askDesc, icon: <Mail className="size-4" /> },
    { id: "microsoft", label: s.outlook, icon: <Mail className="size-4" />, oauth: "microsoft" },
    { id: "google", label: s.gmail, icon: <Mail className="size-4" />, oauth: "google" },
    { id: "device", label: s.device, icon: <Monitor className="size-4" /> },
    { id: "copy", label: s.copy, icon: <Copy className="size-4" /> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground text-pretty">{s.hint}</p>
      <div className="flex flex-col divide-y divide-border">
        {rows.map((r) => {
          const isDefault = status.preferred === r.id
          const prov = r.oauth ? status.providers[r.oauth] : null
          const configured = prov ? prov.configured : true
          const connected = prov ? prov.connected : true
          const canBeDefault = configured && connected
          const badge = prov
            ? !prov.configured
              ? r.oauth === "google"
                ? s.comingSoon
                : s.unconfigured
              : prov.connected
                ? `${s.connected} · ${prov.emailAddress}`
                : s.notConnected
            : r.desc
          return (
            <div key={String(r.id)} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {r.icon}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {r.label}
                    {isDefault && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <Check className="size-3" /> {s.default}
                      </span>
                    )}
                  </span>
                  {badge && <span className="truncate text-xs text-muted-foreground" dir="auto">{badge}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {prov && configured && !connected && (
                  <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => openOAuth(r.oauth!)}>
                    <Link2 className="size-3.5" /> {s.connect}
                  </Button>
                )}
                {prov && connected && (
                  <Button type="button" size="sm" variant="ghost" className="gap-1.5" disabled={busy !== null} onClick={() => disconnect(r.oauth!)}>
                    {busy === `dc:${r.oauth}` ? <Loader2 className="size-3.5 animate-spin" /> : <Unlink className="size-3.5" />}
                    {s.disconnect}
                  </Button>
                )}
                {!isDefault && canBeDefault && (
                  <Button type="button" size="sm" variant="outline" className="bg-transparent" disabled={busy !== null} onClick={() => choose(r.id)}>
                    {busy === `pref:${r.id}` ? <Loader2 className="size-3.5 animate-spin" /> : s.setDefault}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
