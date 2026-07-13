import { cn } from "@/lib/utils"

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
  const has = value != null && String(value).trim() !== ""
  if (has) {
    return <span className={cn("text-muted-foreground", className)}>{value}</span>
  }
  return (
    <span
      title="غير متوفر بالسجل الأصلي"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground/70",
        className,
      )}
    >
      <span aria-hidden>—</span>
      <span className="sr-only">غير متوفر بالسجل الأصلي</span>
      <span className="not-sr-only text-[10px]">غير مسجل</span>
    </span>
  )
}
