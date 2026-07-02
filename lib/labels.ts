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
  closed: "مغلق",
  overdue: "متأخر",
  scheduled: "مجدول",
  pending: "بانتظار الموافقة",
  approved: "معتمد",
  active: "ساري",
  expired: "منتهٍ",
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
  construction: "تصريح عمل إنشائي",
  forklift: "تصريح قيادة رافعة شوكية",
  tuktuk: "تصريح قيادة توك توك",
  visitor: "بطاقة زائر",
  trainee: "بطاقة متدرب",
}
export const permitTypeOptions = [
  { value: "construction", label: "تصريح عمل إنشائي" },
  { value: "forklift", label: "تصريح قيادة رافعة شوكية" },
  { value: "tuktuk", label: "تصريح قيادة توك توك" },
  { value: "visitor", label: "بطاقة زائر" },
  { value: "trainee", label: "بطاقة متدرب" },
]
// بادئة الترقيم التسلسلي لكل نوع تصريح (مثال: CWP-2026-001).
export const permitTypePrefix: Record<string, string> = {
  construction: "CWP",
  forklift: "FLP",
  tuktuk: "TTP",
  visitor: "VIS",
  trainee: "TRN",
}
// الحقول الديناميكية الإضافية لكل نوع تصريح.
export const permitTypeExtraFields: Record<string, { name: string; label: string; placeholder?: string }[]> = {
  construction: [
    { name: "workDescription", label: "وصف العمل", placeholder: "مثال: صب أساسات المستودع" },
    { name: "equipmentUsed", label: "المعدات المستخدمة", placeholder: "مثال: خلاطة خرسانة، سقالات" },
  ],
  forklift: [
    { name: "driverName", label: "اسم السائق" },
    { name: "internalLicenseNo", label: "رقم الرخصة الداخلية" },
    { name: "equipmentNo", label: "رقم المعدة" },
  ],
  tuktuk: [
    { name: "driverName", label: "اسم السائق" },
    { name: "internalLicenseNo", label: "رقم الرخصة الداخلية" },
    { name: "vehicleNo", label: "رقم المركبة" },
  ],
  visitor: [
    { name: "visitorName", label: "اسم الزائر" },
    { name: "visitorCompany", label: "الجهة" },
    { name: "hostName", label: "الشخص المسؤول عن الاستقبال" },
    { name: "visitDuration", label: "مدة الزيارة", placeholder: "مثال: 3 ساعات" },
  ],
  trainee: [
    { name: "traineeName", label: "اسم المتدرب" },
    { name: "traineeDepartment", label: "القسم" },
    { name: "supervisorName", label: "المشرف المسؤول" },
    { name: "trainingDuration", label: "مدة التدريب", placeholder: "مثال: أسبوعين" },
  ],
}

export const violationStatusOptions = [
  { value: "open", label: "مفتوحة" },
  { value: "in_progress", label: "قيد المعالجة" },
  { value: "closed", label: "مغلقة" },
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
  { value: "inspections", label: "التفتيش" },
  { value: "risks", label: "تقييم المخاطر" },
  { value: "permits", label: "تصاريح العمل" },
  { value: "training", label: "التدريب" },
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
