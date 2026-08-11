import { AppShell } from "@/components/app-shell"
import { requireUser } from "@/lib/session"
import Link from "next/link"
import { ShieldAlert, Smartphone, Home } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AiMonitoringUnauthorizedPage() {
  const user = await requireUser()

  return (
    <AppShell user={user} title="المراقبة الذكية (AI)">
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-bold text-foreground text-balance">صفحات المراجعة مقصورة على مسؤول HSE</h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            لوحة المراقبة والبث المباشر والتسجيلات متاحة لمسؤولي HSE فقط (مدير أو أدمن). يمكنك مع ذلك تشغيل بث كاميرا
            هاتفك وإرسال الفيديو للمراجعة.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Link
            href="/ai-monitoring/mobile-camera"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Smartphone className="size-4" />
            فتح بث كاميرا الهاتف
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Home className="size-4" />
            العودة للوحة التحكم
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
