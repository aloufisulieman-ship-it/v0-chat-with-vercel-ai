"use client"

// قائمة اختيار اللغة (عربي / English) — تظهر في الشريط العلوي بكل الصفحات.
// عند الاختيار: نستدعي server action لحفظ التفضيل (كوكي + قاعدة بيانات) ثم نُحدّث
// الصفحة ليُعاد تصييرها باللغة والاتجاه الجديدين.

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Globe, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n/client"
import { locales, localeLabels } from "@/lib/i18n/config"
import { setLocale } from "@/app/actions/locale"
import { toast } from "@/hooks/use-toast"

export function LanguageSwitcher() {
  const { locale, t } = useI18n()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function choose(next: string) {
    if (next === locale || pending) return
    startTransition(async () => {
      await setLocale(next)
      toast({ title: t("toast.languageChanged") })
      // إعادة جلب شجرة الخادم لتطبيق اللغة والاتجاه الجديدين فورًا.
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          aria-label={t("common.language")}
          disabled={pending}
        >
          <Globe className="size-4" />
          <span className="text-sm font-medium">{localeLabels[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => choose(l)}
            className="flex items-center justify-between gap-2"
          >
            <span>{localeLabels[l]}</span>
            {l === locale && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
