import { AppShell } from "@/components/app-shell"
import { requireModule } from "@/lib/session"
import { MobileCamera } from "./mobile-camera"

export const dynamic = "force-dynamic"

export default async function MobileCameraPage() {
  const user = await requireModule("ai_monitoring")

  return (
    <AppShell
      title="بث كاميرا الهاتف"
      subtitle="حوّل هاتفك إلى كاميرا مراقبة ذكية ترسل الإطارات للتحليل تلقائياً"
      user={user}
    >
      <MobileCamera />
    </AppShell>
  )
}
