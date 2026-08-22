"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// حدّ خطأ على مستوى المقاطع (App Router): يلتقط أي خطأ يُرمى أثناء عرض الصفحات
// المعتمدة على قاعدة البيانات (التقارير/الحوادث/المخالفات/...الخ) ويعرض رسالة واضحة
// مع زر إعادة المحاولة، بدل صفحة فارغة صامتة كانت تُصعّب تشخيص الأعطال.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // نسجّل الخطأ لتشخيص أي عطل مستقبلي بسهولة من السجلات.
    console.error("[v0] Page error boundary:", error)
  }, [error])

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="flex max-w-md flex-col items-center gap-4 p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold text-foreground text-balance">تعذّر تحميل بيانات هذه الصفحة</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            حدث خطأ أثناء جلب البيانات من قاعدة البيانات. يُرجى إعادة المحاولة، وإذا تكرر الخطأ فأبلغ مسؤول النظام.
          </p>
          <p className="text-sm text-muted-foreground text-pretty" dir="ltr">
            We couldn&apos;t load this page&apos;s data. Please try again.
          </p>
        </div>
        {error.digest ? (
          <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground" dir="ltr">
            {`ref: ${error.digest}`}
          </code>
        ) : null}
        <Button onClick={reset} className="gap-2">
          <RotateCcw className="size-4" aria-hidden="true" />
          إعادة المحاولة
        </Button>
      </Card>
    </main>
  )
}
