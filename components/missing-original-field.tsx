"use client"

import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"

/**
 * يعرض قيمة حقل مستوردة من السجل الأصلي.
 * - إذا كانت القيمة موجودة فعلياً: تُعرض كما هي (عرض مباشر لما هو مخزّن، بلا أي تخمين أو fallback ذكي).
 * - إذا كانت null/فارغة: يُعرض تمييز بصري رمادي "-" مع tooltip يوضح أنها غير متوفرة بالسجل الأصلي،
 *   لتمييزها عن الأخطاء الفعلية. لا يوجد أي منطق يولّد أو يخمّن قيمة بديلة.
 */
export function MissingOriginalField({
  value,
  className,
}: {
  value: string | null | undefined
  className?: string
}) {
  const { t } = useI18n()
  const has = value != null && String(value).trim() !== ""
  if (has) {
    return <span className={cn("text-muted-foreground", className)}>{value}</span>
  }
  return (
    <span
      title={t("badges.notInSource")}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground/70",
        className,
      )}
    >
      <span aria-hidden>—</span>
      <span className="sr-only">{t("badges.notInSource")}</span>
      <span className="not-sr-only text-[10px]">{t("badges.notRecorded")}</span>
    </span>
  )
}
