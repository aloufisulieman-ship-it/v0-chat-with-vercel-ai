// ثوابت مركز الأقسام والإحالات — آمنة للاستخدام في الخادم والعميل (بلا استيراد قاعدة بيانات).

export const DEPT_CODES = ["HSE", "HR", "FIN", "OPS", "MNT", "PRC", "IT", "CS", "MGMT"] as const
export type DeptCode = (typeof DEPT_CODES)[number]

// الأقسام الافتراضية التي تُبذَر لكل مؤسسة عند الترحيل. slaHours = مهلة المعالجة بالساعات.
export const DEFAULT_DEPARTMENTS: { code: DeptCode; nameAr: string; slaHours: number }[] = [
  { code: "HSE", nameAr: "السلامة والصحة المهنية", slaHours: 24 },
  { code: "HR", nameAr: "الموارد البشرية", slaHours: 48 },
  { code: "FIN", nameAr: "المالية", slaHours: 72 },
  { code: "OPS", nameAr: "العمليات", slaHours: 48 },
  { code: "MNT", nameAr: "الصيانة", slaHours: 48 },
  { code: "PRC", nameAr: "المشتريات", slaHours: 72 },
  { code: "IT", nameAr: "تقنية المعلومات", slaHours: 48 },
  { code: "CS", nameAr: "خدمة العملاء", slaHours: 48 },
  { code: "MGMT", nameAr: "الإدارة العليا", slaHours: 48 },
]

export const deptCodeLabels: Record<string, string> = Object.fromEntries(
  DEFAULT_DEPARTMENTS.map((d) => [d.code, d.nameAr]),
)

// أنواع السجلات القابلة للإحالة بين الأقسام.
export const SOURCE_TYPES = [
  "violation",
  "incident",
  "inspection",
  "permit",
  "risk",
  "audit",
  "observation",
  "action",
] as const
export type ReferralSourceType = (typeof SOURCE_TYPES)[number]

export const sourceTypeLabels: Record<ReferralSourceType, string> = {
  violation: "مخالفة",
  incident: "حادث",
  inspection: "تفتيش",
  permit: "تصريح عمل",
  risk: "خطر",
  audit: "تدقيق",
  observation: "ملاحظة",
  action: "إجراء تصحيحي",
}

// المسار الأساسي لوحدة كل نوع سجل — لبناء رابط السجل الأصلي من الإحالة.
export const sourceTypeRoute: Record<ReferralSourceType, string> = {
  violation: "/violations",
  incident: "/incidents",
  inspection: "/inspections",
  permit: "/permits",
  risk: "/risks",
  audit: "/audits",
  observation: "/patrol",
  action: "/actions",
}

// حالات الإحالة ومسارها: new → acknowledged → in_progress → closed، مع returned كمسار جانبي.
export const REFERRAL_STATUSES = ["new", "acknowledged", "in_progress", "returned", "closed"] as const
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number]

export const referralStatusLabels: Record<ReferralStatus, string> = {
  new: "جديدة",
  acknowledged: "مستلمة",
  in_progress: "قيد المعالجة",
  returned: "مُعادة",
  closed: "مغلقة",
}

// فئات ألوان الشارات مستمدة من رموز التصميم في globals.css (لا ألوان ثابتة inline).
export const referralStatusBadge: Record<ReferralStatus, string> = {
  new: "bg-primary/10 text-primary",
  acknowledged: "bg-accent text-accent-foreground",
  in_progress: "bg-primary/15 text-primary",
  returned: "bg-destructive/10 text-destructive",
  closed: "bg-muted text-muted-foreground",
}

export const priorityLabels: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
}
export const priorityBadge: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-accent text-accent-foreground",
  high: "bg-destructive/10 text-destructive",
  critical: "bg-destructive/15 text-destructive",
}

// إحالة مفتوحة = لم تُغلق بعد.
export function isOpenReferral(status: string): boolean {
  return status !== "closed"
}

// حساب موعد الاستحقاق من مهلة القسم (بالساعات).
export function computeDueAt(from: Date, slaHours: number): Date {
  return new Date(from.getTime() + slaHours * 3_600_000)
}

// متأخرة = لها موعد استحقاق مضى ولم تُغلق بعد.
export function isOverdue(dueAt: Date | string | null | undefined, status: string): boolean {
  if (!dueAt || status === "closed") return false
  return new Date(dueAt).getTime() < Date.now()
}

export function isSourceType(v: string): v is ReferralSourceType {
  return (SOURCE_TYPES as readonly string[]).includes(v)
}
export function isReferralStatus(v: string): v is ReferralStatus {
  return (REFERRAL_STATUSES as readonly string[]).includes(v)
}
