// لوحة ألوان الخطورة الموحَّدة لكل رسوم لوحة التحكم (دونات التوزيع + أعمدة النوع المكدّسة).
// منخفضة أخضر / متوسطة كهرماني / عالية برتقالي / حرجة أحمر — قيم oklch متّسقة مع الثيم
// وتعمل في الوضعَين الفاتح والداكن لأنها مشبَعة ومتوسّطة الإضاءة.
export const SEVERITIES = ["low", "medium", "high", "critical"] as const
export type Severity = (typeof SEVERITIES)[number]

export const SEVERITY_FILL: Record<Severity, string> = {
  low: "oklch(0.72 0.17 150)", // أخضر
  medium: "oklch(0.80 0.16 85)", // كهرماني
  high: "oklch(0.72 0.19 45)", // برتقالي
  critical: "oklch(0.60 0.22 25)", // أحمر
}
