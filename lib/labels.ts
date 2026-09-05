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
  rejected: "مرفوض",
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

// أنواع المعدات في سجل المعدات المرجعي (المطابقة تتم عبر لوحة المركبة الرسمية).
export const equipmentTypeOptions = [
  { value: "forklift", label: "رافعة شوكية" },
  { value: "tuktuk", label: "توك توك" },
  { value: "truck", label: "شاحنة" },
  { value: "crane", label: "رافعة" },
  { value: "other", label: "أخرى" },
]
export const equipmentTypeLabels: Record<string, string> = Object.fromEntries(
  equipmentTypeOptions.map((e) => [e.value, e.label]),
)

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
  { value: "employees", label: "سجل الموظفين" },
  { value: "violations", label: "المخالفات" },
  { value: "patrol", label: "الجولة التفتيشية" },
  { value: "ai_monitoring", label: "المراقبة الذكية (AI)" },
  { value: "equipment", label: "سجل المعدات" },
  { value: "safety_rules", label: "قواعد السلامة" },
  { value: "hr", label: "الموارد البشرية" },
  { value: "finance", label: "المالية" },
  { value: "actions", label: "الإجراءات التصحيحية" },
  { value: "audits", label: "التدقيق" },
  { value: "compliance", label: "مطابقة ISO 45001" },
  { value: "context", label: "سياق المنظمة" },
  { value: "policy", label: "سياسة السلامة" },
  { value: "objectives", label: "الأهداف والخطط" },
  { value: "legal-register", label: "السجل القانوني" },
  { value: "consultation", label: "تشاور العمال" },
  { value: "emergency", label: "التأهب للطوارئ" },
  { value: "contractors", label: "المقاولون" },
  { value: "management-review", label: "مراجعة الإدارة" },
  { value: "internal-audit", label: "التدقيق الداخلي" },
  { value: "documents", label: "الوثائق" },
  { value: "reports", label: "التقارير" },
  { value: "settings", label: "الإعدادات" },
  { value: "users", label: "إدارة المستخدمين" },
] as const
export const moduleLabels: Record<string, string> = Object.fromEntries(
  moduleOptions.map((m) => [m.value, m.label]),
)
export type ModuleKey = (typeof moduleOptions)[number]["value"]

// نطاقات مصفوفة المخاطر 5×5 وفق ISO 45001:2018 — مصدر واحد للحقيقة تستمد منه
// الخلية والشارة والمفتاح (legend) قيمتها ولونها. لا ألوان ثابتة inline في أي مكان.
export type RiskBandId = "low" | "medium" | "high" | "critical"
export type RiskBand = {
  id: RiskBandId
  min: number
  max: number
  // فئات لون الخلفية/النص مستمدة من رموز التصميم (tokens) المعرّفة في globals.css.
  cell: string
  badge: string
  swatch: string
}

export const RISK_BANDS: RiskBand[] = [
  { id: "low", min: 1, max: 4, cell: "bg-risk-low text-risk-low-foreground", badge: "bg-risk-low/15 text-risk-low", swatch: "bg-risk-low" },
  { id: "medium", min: 5, max: 9, cell: "bg-risk-medium text-risk-medium-foreground", badge: "bg-risk-medium/20 text-risk-medium-foreground", swatch: "bg-risk-medium" },
  { id: "high", min: 10, max: 15, cell: "bg-risk-high text-risk-high-foreground", badge: "bg-risk-high/15 text-risk-high", swatch: "bg-risk-high" },
  { id: "critical", min: 16, max: 25, cell: "bg-risk-critical text-risk-critical-foreground", badge: "bg-risk-critical/15 text-risk-critical", swatch: "bg-risk-critical" },
]

export function getRiskBand(value: number): RiskBand {
  return RISK_BANDS.find((b) => value >= b.min && value <= b.max) ?? RISK_BANDS[0]
}

const riskLevelLabels: Record<RiskBandId, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "عالٍ",
  critical: "حرج",
}

export function riskLevel(score: number): { value: RiskBandId; label: string } {
  const band = getRiskBand(score)
  return { value: band.id, label: riskLevelLabels[band.id] }
}
