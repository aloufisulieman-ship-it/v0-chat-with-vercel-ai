"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { Loader2, Mail, Monitor, Copy, Link2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import {
  getEmailAccountsStatus,
  sendReportEmail,
  setPreferredEmailProvider,
  type EmailProviderChoice,
} from "@/app/actions/email-accounts"
import {
  exportReportByEmail,
  emailExportNotice,
  type EmailContent,
  type EmailLocale,
} from "@/lib/email-export"

// نافذة اختيار برنامج البريد لإرسال التقرير. المسار:
//  - لديه تفضيل محفوظ → تُخفى قائمة الخيارات ويُنفَّذ الخيار مباشرة مع رابط «تغيير برنامج البريد».
//  - لا تفضيل → تُعرض الخيارات؛ «اجعله خياري الافتراضي» يحفظ الاختيار في إعدادات المستخدم.
// الخيارات: Outlook (OAuth) | Gmail (OAuth) | تطبيق البريد على الجهاز (.eml/Share) | نسخ + تنزيل.

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  locale: EmailLocale
  // يبني PDF التقرير ونص الرسالة بعد إدخال المستلم (يحتاج اسم الجهة للتحية).
  build: (recipientName: string) => Promise<{ pdfBlob: Blob; content: EmailContent }>
  // لتفعيل الرجوع إلى هذه الصفحة بعد ربط حساب OAuth.
  returnPath?: string
}

const L = {
  ar: {
    title: "إرسال التقرير بالبريد",
    desc: "اختر برنامج البريد الذي تريد استخدامه.",
    recipientName: "اسم الجهة المستلمة (اختياري)",
    recipientNamePlaceholder: "مثال: إدارة الموارد البشرية",
    recipientEmail: "بريد المستلم",
    recipientEmailOptional: "بريد المستلم (اختياري)",
    outlook: "Outlook / Microsoft 365",
    gmail: "Gmail",
    device: "تطبيق البريد على الجهاز",
    copy: "نسخ النص وتنزيل المرفق",
    outlookDesc: "إرسال مباشر من بريدك بنقرة واحدة، والمرفق مضمَّن.",
    gmailDesc: "إرسال مباشر من حساب Gmail المرتبط.",
    deviceDesc: "يفتح Outlook أو تطبيق البريد الافتراضي برسالة جاهزة والمرفق بداخلها.",
    copyDesc: "ينسخ الموضوع والنص إلى الحافظة ويُنزّل PDF لإلصاقه في أي برنامج بريد.",
    notConnected: "غير مرتبط",
    connected: "مرتبط",
    connect: "ربط الحساب",
    unconfigured: "غير مُفعَّل من المسؤول",
    comingSoon: "قريباً",
    makeDefault: "اجعله خياري الافتراضي (يمكن تغييره من الإعدادات)",
    changeProvider: "تغيير برنامج البريد",
    usingDefault: "سيُرسَل عبر:",
    send: "إرسال",
    open: "فتح تطبيق البريد",
    copyBtn: "نسخ وتنزيل",
    preparing: "جارٍ التجهيز...",
    sending: "جارٍ الإرسال...",
    cancel: "إلغاء",
    sentTitle: "تم إرسال البريد",
    sentDesc: "أُرسل التقرير إلى {email} من بريدك المرتبط.",
    copiedTitle: "تم النسخ وتنزيل المرفق",
    copiedDesc: "الموضوع والنص في الحافظة، والتقرير PDF في مجلد التنزيلات.",
    failTitle: "تعذّر الإرسال",
    invalidEmail: "البريد الإلكتروني غير صالح",
    needEmail: "أدخل بريد المستلم للإرسال المباشر",
    needConnect: "اربط حسابك أولاً من زر «ربط الحساب»",
  },
  en: {
    title: "Send report by email",
    desc: "Choose the mail program to use.",
    recipientName: "Recipient (optional)",
    recipientNamePlaceholder: "e.g. Human Resources Department",
    recipientEmail: "Recipient email",
    recipientEmailOptional: "Recipient email (optional)",
    outlook: "Outlook / Microsoft 365",
    gmail: "Gmail",
    device: "Mail app on this device",
    copy: "Copy text & download attachment",
    outlookDesc: "One-click send from your own mailbox with the attachment included.",
    gmailDesc: "Direct send from your linked Gmail account.",
    deviceDesc: "Opens Outlook or your default mail app with a ready message and the attachment inside.",
    copyDesc: "Copies subject and body to the clipboard and downloads the PDF for any mail program.",
    notConnected: "Not connected",
    connected: "Connected",
    connect: "Connect account",
    unconfigured: "Not enabled by admin",
    comingSoon: "Coming soon",
    makeDefault: "Make this my default (changeable in Settings)",
    changeProvider: "Change mail program",
    usingDefault: "Will be sent via:",
    send: "Send",
    open: "Open mail app",
    copyBtn: "Copy & download",
    preparing: "Preparing...",
    sending: "Sending...",
    cancel: "Cancel",
    sentTitle: "Email sent",
    sentDesc: "The report was sent to {email} from your linked mailbox.",
    copiedTitle: "Copied and attachment downloaded",
    copiedDesc: "Subject and body are on the clipboard; the PDF is in your downloads.",
    failTitle: "Could not send",
    invalidEmail: "Invalid email address",
    needEmail: "Enter a recipient email for direct sending",
    needConnect: "Connect your account first using “Connect account”",
  },
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => {
      const s = String(r.result || "")
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s)
    }
    r.onerror = () => reject(new Error("read failed"))
    r.readAsDataURL(blob)
  })
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function openOAuth(provider: "microsoft" | "google", returnPath: string) {
  const url = `/api/email-accounts/${provider}/start?return=${encodeURIComponent(returnPath)}`
  // داخل إطار مُضمَّن (معاينة v0) نفتح نافذة جديدة؛ وإلا في نفس التبويب.
  if (typeof window !== "undefined" && window.self !== window.top) {
    window.open(url, "_blank", "noopener,noreferrer")
  } else {
    window.location.href = url
  }
}

export function EmailProviderDialog({ open, onOpenChange, locale, build, returnPath }: Props) {
  const s = L[locale]
  const isRtl = locale === "ar"
  const { data: status, mutate } = useSWR(open ? "email-accounts-status" : null, () => getEmailAccountsStatus())

  const [recipientName, setRecipientName] = useState("")
  const [emailTo, setEmailTo] = useState("")
  const [choice, setChoice] = useState<EmailProviderChoice | null>(null)
  const [makeDefault, setMakeDefault] = useState(false)
  const [showPicker, setShowPicker] = useState(true)
  const [busy, setBusy] = useState(false)

  // عند الفتح: إن وُجد تفضيل محفوظ نُخفي القائمة ونستخدمه مباشرة.
  useEffect(() => {
    if (!open || !status) return
    if (status.preferred) {
      setChoice(status.preferred)
      setShowPicker(false)
    } else {
      setChoice(null)
      setShowPicker(true)
    }
    setMakeDefault(false)
  }, [open, status])

  const oauthReady = (p: "microsoft" | "google") => !!status?.providers[p].configured && !!status?.providers[p].connected
  const returnTo = returnPath || (typeof window !== "undefined" ? window.location.pathname : "/")

  async function run() {
    if (!choice) return
    const to = emailTo.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const isOAuth = choice === "microsoft" || choice === "google"
    if (isOAuth && !to) return toast({ title: s.needEmail, variant: "destructive" })
    if (to && !emailRegex.test(to)) return toast({ title: s.invalidEmail, variant: "destructive" })
    if (isOAuth && !oauthReady(choice)) return toast({ title: s.needConnect, variant: "destructive" })

    setBusy(true)
    try {
      const { pdfBlob, content } = await build(recipientName)

      if (isOAuth) {
        await sendReportEmail({
          provider: choice,
          to,
          subject: content.subject,
          body: content.body,
          fileName: content.fileName,
          pdfBase64: await blobToBase64(pdfBlob),
        })
        toast({ title: s.sentTitle, description: s.sentDesc.replace("{email}", to) })
      } else if (choice === "device") {
        const method = await exportReportByEmail({ pdfBlob, content, to: to || undefined })
        const n = emailExportNotice(method, locale)
        toast({ title: n.title, description: n.description, variant: method === "mailto" ? "destructive" : "default" })
      } else {
        await navigator.clipboard.writeText(`${content.subject}\n\n${content.body}`).catch(() => {})
        downloadBlob(pdfBlob, content.fileName)
        toast({ title: s.copiedTitle, description: s.copiedDesc })
      }

      if (makeDefault && showPicker) {
        await setPreferredEmailProvider(choice)
        mutate()
      }
      onOpenChange(false)
      setEmailTo("")
      setRecipientName("")
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      toast({ title: s.failTitle, description: err instanceof Error ? err.message : String(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const options: {
    id: EmailProviderChoice
    label: string
    desc: string
    icon: React.ReactNode
    badge?: string
    action?: React.ReactNode
    disabled?: boolean
  }[] = [
    {
      id: "microsoft",
      label: s.outlook,
      desc: s.outlookDesc,
      icon: <Mail className="size-4" />,
      badge: !status?.providers.microsoft.configured
        ? s.unconfigured
        : status.providers.microsoft.connected
          ? `${s.connected} · ${status.providers.microsoft.emailAddress}`
          : s.notConnected,
      disabled: !status?.providers.microsoft.configured,
      action:
        status?.providers.microsoft.configured && !status.providers.microsoft.connected ? (
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => openOAuth("microsoft", returnTo)}>
            <Link2 className="size-3.5" /> {s.connect}
          </Button>
        ) : undefined,
    },
    {
      id: "google",
      label: s.gmail,
      desc: s.gmailDesc,
      icon: <Mail className="size-4" />,
      badge: !status?.providers.google.configured
        ? s.comingSoon
        : status.providers.google.connected
          ? `${s.connected} · ${status.providers.google.emailAddress}`
          : s.notConnected,
      disabled: !status?.providers.google.configured,
      action:
        status?.providers.google.configured && !status.providers.google.connected ? (
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => openOAuth("google", returnTo)}>
            <Link2 className="size-3.5" /> {s.connect}
          </Button>
        ) : undefined,
    },
    { id: "device", label: s.device, desc: s.deviceDesc, icon: <Monitor className="size-4" /> },
    { id: "copy", label: s.copy, desc: s.copyDesc, icon: <Copy className="size-4" /> },
  ]

  const isOAuthChoice = choice === "microsoft" || choice === "google"
  const primaryLabel = busy
    ? isOAuthChoice
      ? s.sending
      : s.preparing
    : isOAuthChoice
      ? s.send
      : choice === "copy"
        ? s.copyBtn
        : s.open
  const chosen = options.find((o) => o.id === choice)

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{s.title}</DialogTitle>
          <DialogDescription>{s.desc}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="epd-name">{s.recipientName}</Label>
            <Input id="epd-name" placeholder={s.recipientNamePlaceholder} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} disabled={busy} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="epd-to">{isOAuthChoice ? s.recipientEmail : s.recipientEmailOptional}</Label>
            <Input id="epd-to" type="email" dir="ltr" placeholder="name@example.com" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} disabled={busy} />
          </div>

          {!status ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : showPicker ? (
            <div role="radiogroup" aria-label={s.desc} className="flex flex-col gap-2">
              {options.map((o) => {
                const selected = choice === o.id
                return (
                  <div
                    key={o.id}
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={o.disabled}
                    tabIndex={o.disabled ? -1 : 0}
                    onClick={() => !o.disabled && setChoice(o.id)}
                    onKeyDown={(e) => {
                      if (!o.disabled && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        setChoice(o.id)
                      }
                    }}
                    className={`flex items-start gap-3 rounded-md border p-3 text-start transition-colors ${
                      o.disabled
                        ? "cursor-not-allowed opacity-60"
                        : selected
                          ? "cursor-pointer border-primary bg-primary/5"
                          : "cursor-pointer hover:bg-muted/50"
                    }`}
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border">
                      {selected && <Check className="size-3.5 text-primary" />}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {o.icon}
                          {o.label}
                        </span>
                        {o.badge && <span className="text-xs text-muted-foreground">{o.badge}</span>}
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">{o.desc}</p>
                      {o.action && <div className="pt-1">{o.action}</div>}
                    </div>
                  </div>
                )
              })}
              <div className="mt-1 flex items-center gap-2">
                <Checkbox
                  id="epd-default"
                  checked={makeDefault}
                  onCheckedChange={(v) => setMakeDefault(v === true)}
                  disabled={busy || !choice}
                />
                <Label htmlFor="epd-default" className="text-sm font-normal">
                  {s.makeDefault}
                </Label>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{s.usingDefault}</span>
                <span className="flex items-center gap-1.5 font-medium">
                  {chosen?.icon}
                  {chosen?.label}
                </span>
              </div>
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setShowPicker(true)}>
                {s.changeProvider}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {s.cancel}
          </Button>
          <Button onClick={run} disabled={busy || !choice || !status} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            {primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
