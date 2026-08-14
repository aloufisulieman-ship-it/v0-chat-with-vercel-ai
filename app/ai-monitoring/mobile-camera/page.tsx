import { requireUser } from "@/lib/session"
import { MobileCamera } from "./mobile-camera"
import { SignOutButton } from "./sign-out-button"
import { Cctv } from "lucide-react"

export const dynamic = "force-dynamic"

// صفحة مستقلة تماماً للموظف المصوّر: لا قائمة جانبية ولا روابط لصفحات المراجعة.
// متاحة لأي مستخدم مسجّل دخول (بعد الاعتماد)، دون اشتراط صلاحية المراقبة الذكية.
export default async function MobileCameraPage() {
  const u = await requireUser()

  return (
    <div className="flex min-h-svh flex-col bg-background" dir="rtl">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Cctv className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-tight text-foreground">بث كاميرا الهاتف</span>
              <span className="text-xs text-muted-foreground">{u.name}</span>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5">
        <p className="mx-auto mb-4 w-full max-w-xl text-sm text-muted-foreground text-pretty">
          حوّل هاتفك إلى كاميرا مراقبة: ابدأ البث الحي للتحليل اللحظي، أو سجّل مقطع فيديو ليُراجعه مسؤول السلامة لاحقاً.
        </p>
        <MobileCamera />
      </main>
    </div>
  )
}
