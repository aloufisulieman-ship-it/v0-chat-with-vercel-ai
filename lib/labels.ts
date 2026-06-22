// خرائط القيم المخزنة في قاعدة البيانات إلى نصوص عربية، وقوائم الخيارات للنماذج

export const severityLabels: Record<string, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "عالٍ",
  critical: "حرج",
}
export const severityOptions = [
  { value: "low", label: "منخفض" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "عالٍ" },
  { value: "critical", label: "حرج" },
]

export const statusLabels: Record<string, string> = {
  open: "مفتوح",
  in_progress: "قيد المعالجة",
  investigating: "قيد التحقيق",
  under_review: "قيد المراجعة",
  closed: "مغلق",
  overdue: "متأخر",
  scheduled: "مجدول",
  pending: "بانتظار الموافقة",
  approved: "معتمد",
  active: "ساري",
  expired: "منتهٍ",
  sufficient: "كافٍ",
  low_stock: "مخزون منخفض",
}
export const statusOptions = [
  { value: "open", label: "مفتوح" },
  { value: "in_progress", label: "قيد المعالجة" },
  { value: "closed", label: "مغلق" },
  { value: "overdue", label: "متأخر" },
]
export const inspectionStatusOptions = [
  { value: "scheduled", label: "مجدول" },
  { value: "in_progress", label: "قيد المعالجة" },
  { value: "closed", label: "مكتمل" },
]
export const permitStatusOptions = [
  { value: "pending", label: "بانتظار الموافقة" },
  { value: "approved", label: "معتمد" },
  { value: "active", label: "ساري" },
  { value: "expired", label: "منتهٍ" },
]

export const incidentTypeLabels: Record<string, string> = {
  near_miss: "حادث وشيك",
  injury: "إصابة",
  property: "أضرار ممتلكات",
  environmental: "بيئي",
  fire: "حريق",
  chemical: "كيميائي",
}
export const incidentTypeOptions = [
  { value: "near_miss", label: "حادث وشيك" },
  { value: "injury", label: "إصابة" },
  { value: "property", label: "أضرار ممتلكات" },
  { value: "environmental", label: "بيئي" },
  { value: "fire", label: "حريق" },
  { value: "chemical", label: "كيميائي" },
]

export const permitTypeLabels: Record<string, string> = {
  hot_work: "أعمال ساخنة",
  confined_space: "أماكن مغلقة",
  electrical: "أعمال كهربائية",
  excavation: "حفريات",
  height: "العمل على ارتفاع",
}
export const permitTypeOptions = [
  { value: "hot_work", label: "أعمال ساخنة" },
  { value: "confined_space", label: "أماكن مغلقة" },
  { value: "electrical", label: "أعمال كهربائية" },
  { value: "excavation", label: "حفريات" },
  { value: "height", label: "العمل على ارتفاع" },
]

// حالات الحادث الوشيك
export const nearMissStatusOptions = [
  { value: "open", label: "مفتوح" },
  { value: "under_review", label: "قيد المراجعة" },
  { value: "closed", label: "مغلق" },
]

// تصنيفات الحادث الوشيك
export const nearMissCategoryOptions = [
  { value: "forklift_equipment", label: "رافعة شوكية / معدات" },
  { value: "pedestrian_safety", label: "سلامة المشاة" },
  { value: "ppe", label: "معدات الوقاية الشخصية" },
  { value: "route_violation", label: "مخالفة مسار" },
  { value: "electrical", label: "كهربائي" },
  { value: "fire", label: "حريق" },
  { value: "manual_handling", label: "المناولة اليدوية" },
  { value: "other", label: "أخرى" },
]
export const nearMissCategoryLabels: Record<string, string> = Object.fromEntries(
  nearMissCategoryOptions.map((c) => [c.value, c.label]),
)

export const violationStatusOptions = [
  { value: "open", label: "مفتوحة" },
  { value: "in_progress", label: "قيد المعالجة" },
  { value: "closed", label: "مغلقة" },
]

export const ppeStatusOptions = [
  { value: "sufficient", label: "كافٍ" },
  { value: "low_stock", label: "مخزون منخفض" },
]

export const departmentOptions = [
  { value: "hr", label: "الموارد البشرية" },
  { value: "workshop", label: "الورشة" },
  { value: "inspector", label: "مفتش السلامة" },
  { value: "gm", label: "المدير العام" },
  { value: "operations", label: "العمليات" },
]
export const departmentLabels: Record<string, string> = Object.fromEntries(
  departmentOptions.map((d) => [d.value, d.label]),
)

// الصفحات/الوحدات المتاحة للصلاحيات
export const moduleOptions = [
  { value: "dashboard", label: "لوحة التحكم" },
  { value: "incidents", label: "الحوادث" },
  { value: "near-miss", label: "الحوادث الوشيكة" },
  { value: "inspections", label: "التفتيش" },
  { value: "risks", label: "تقييم المخاطر" },
  { value: "permits", label: "تصاريح العمل" },
  { value: "training", label: "التدريب" },
  { value: "ppe", label: "معدات الوقاية" },
  { value: "violations", label: "المخالفات" },
  { value: "hr", label: "الموارد البشرية" },
  { value: "actions", label: "الإجراءات التصحيحية" },
  { value: "audits", label: "التدقيق" },
  { value: "documents", label: "الوثائق" },
  { value: "reports", label: "التقارير" },
  { value: "settings", label: "الإعدادات" },
  { value: "users", label: "إدارة المستخدمين" },
] as const
export const moduleLabels: Record<string, string> = Object.fromEntries(
  moduleOptions.map((m) => [m.value, m.label]),
)
export type ModuleKey = (typeof moduleOptions)[number]["value"]

export function riskLevel(score: number): { value: string; label: string } {
  if (score >= 15) return { value: "critical", label: "حرج" }
  if (score >= 9) return { value: "high", label: "عالٍ" }
  if (score >= 4) return { value: "medium", label: "متوسط" }
  return { value: "low", label: "منخفض" }
}
