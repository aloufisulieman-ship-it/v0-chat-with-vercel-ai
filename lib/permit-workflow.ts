// ================= تصريح العمل (Permit to Work) — التهيئة المشتركة =================
// وحدة آمنة للعميل والخادم: تعرّف أنواع التصاريح، دورة الحياة، قوائم الفحص الديناميكية،
// الحقول الخاصة بكل نوع، الترقيم، وحسابات الوقت المتبقي. لا تستورد أي شيء من الخادم.

export type PermitStatus =
  | "draft"
  | "pending"
  | "active"
  | "suspended"
  | "closed"
  | "rejected"
  | "expired"

export const PERMIT_STATUSES: PermitStatus[] = [
  "draft",
  "pending",
  "active",
  "suspended",
  "closed",
  "rejected",
  "expired",
]

// تسميات الحالة (عربي/إنجليزي) وألوان الشارة عبر رموز التصميم الدلالية.
const STATUS_LABEL: Record<PermitStatus, { ar: string; en: string }> = {
  draft: { ar: "مسودة", en: "Draft" },
  pending: { ar: "بانتظار الاعتماد", en: "Pending approval" },
  active: { ar: "ساري", en: "Active" },
  suspended: { ar: "موقوف مؤقتاً", en: "Suspended" },
  closed: { ar: "مغلق", en: "Closed" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  expired: { ar: "منتهٍ", en: "Expired" },
}

const STATUS_BADGE: Record<PermitStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending: "bg-warning/10 text-warning border-warning/30",
  active: "bg-success/10 text-success border-success/30",
  suspended: "bg-accent/10 text-accent border-accent/30",
  closed: "bg-muted text-muted-foreground border-border",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  expired: "bg-destructive/10 text-destructive border-destructive/30",
}

export function normalizePermitStatus(raw: string | null | undefined): PermitStatus {
  const v = (raw ?? "").trim()
  if ((PERMIT_STATUSES as string[]).includes(v)) return v as PermitStatus
  // تحويل القيم القديمة.
  if (v === "approved") return "active"
  if (v === "" ) return "pending"
  return "pending"
}

export function permitStatusLabel(s: PermitStatus, loc: "ar" | "en" = "ar"): string {
  return STATUS_LABEL[s][loc]
}

export function permitStatusBadgeClass(s: PermitStatus): string {
  return STATUS_BADGE[s]
}

// ================= أنواع التصاريح =================
export type PermitTypeId =
  | "hot_work"
  | "confined_space"
  | "work_at_height"
  | "electrical"
  | "excavation"
  | "cold_work"
  | "lifting"

export interface PermitTypeConfig {
  id: PermitTypeId
  ar: string
  en: string
  prefix: string
  // متطلبات إضافية خاصة بالنوع تُفعّل حقولاً في النموذج.
  requiresGasTest?: boolean
  requiresLOTO?: boolean
  defaultRisk: "low" | "medium" | "high"
}

export const PERMIT_TYPES: PermitTypeConfig[] = [
  { id: "hot_work", ar: "عمل ساخن", en: "Hot work", prefix: "HW", requiresGasTest: true, defaultRisk: "high" },
  { id: "confined_space", ar: "دخول أماكن محصورة", en: "Confined space entry", prefix: "CSE", requiresGasTest: true, defaultRisk: "high" },
  { id: "work_at_height", ar: "العمل على ارتفاع", en: "Work at height", prefix: "WAH", defaultRisk: "high" },
  { id: "electrical", ar: "أعمال كهربائية", en: "Electrical work", prefix: "ELE", requiresLOTO: true, defaultRisk: "high" },
  { id: "excavation", ar: "أعمال حفر", en: "Excavation", prefix: "EXC", defaultRisk: "high" },
  { id: "cold_work", ar: "عمل بارد", en: "Cold work", prefix: "CW", defaultRisk: "medium" },
  { id: "lifting", ar: "أعمال رفع", en: "Lifting operations", prefix: "LIFT", requiresLOTO: true, defaultRisk: "high" },
]

export function getPermitType(id: string | null | undefined): PermitTypeConfig {
  return PERMIT_TYPES.find((t) => t.id === id) ?? PERMIT_TYPES[0]
}

export function permitTypeLabel(id: string | null | undefined, loc: "ar" | "en" = "ar"): string {
  const t = getPermitType(id)
  return loc === "ar" ? t.ar : t.en
}

// ================= قوائم الفحص الديناميكية =================
export interface ChecklistItem {
  id: string
  ar: string
  en: string
}

// بنود عامة تنطبق على كل التصاريح.
const COMMON_CHECKLIST: ChecklistItem[] = [
  { id: "ppe", ar: "معدات الوقاية الشخصية متوفرة ومطابقة", en: "PPE available and compliant" },
  { id: "area_barricaded", ar: "منطقة العمل معزولة ومحاطة بحواجز", en: "Work area barricaded" },
  { id: "toolbox_talk", ar: "تم عقد اجتماع السلامة التمهيدي", en: "Toolbox talk conducted" },
  { id: "emergency_plan", ar: "خطة الطوارئ ومسارات الإخلاء واضحة", en: "Emergency plan and exits clear" },
]

const TYPE_CHECKLIST: Record<PermitTypeId, ChecklistItem[]> = {
  hot_work: [
    { id: "fire_extinguisher", ar: "طفاية حريق صالحة في متناول اليد", en: "Serviceable fire extinguisher on hand" },
    { id: "fire_watch", ar: "تعيين مراقب حريق طوال العمل وبعده", en: "Fire watch assigned during and after work" },
    { id: "combustibles_removed", ar: "إزالة المواد القابلة للاشتعال (10م)", en: "Combustibles removed (10m radius)" },
    { id: "gas_free", ar: "المنطقة خالية من الأبخرة القابلة للاشتعال", en: "Area free of flammable vapors" },
  ],
  confined_space: [
    { id: "gas_test_done", ar: "تم فحص الغازات قبل الدخول", en: "Gas test performed before entry" },
    { id: "attendant", ar: "وجود مراقب خارجي دائم", en: "Standby attendant present" },
    { id: "ventilation", ar: "تهوية كافية للمكان المحصور", en: "Adequate ventilation provided" },
    { id: "rescue_plan", ar: "خطة إنقاذ ومعدات إنقاذ جاهزة", en: "Rescue plan and equipment ready" },
  ],
  work_at_height: [
    { id: "harness", ar: "أحزمة الأمان مفحوصة وسليمة", en: "Fall harnesses inspected and sound" },
    { id: "anchor_points", ar: "نقاط تثبيت معتمدة ومتينة", en: "Certified anchor points" },
    { id: "scaffold_tag", ar: "بطاقة اعتماد السقالة سارية", en: "Scaffold inspection tag valid" },
    { id: "drop_zone", ar: "تأمين منطقة سقوط الأدوات أسفل العمل", en: "Drop zone secured below" },
  ],
  electrical: [
    { id: "loto_applied", ar: "تم تطبيق العزل والإقفال والتوسيم (LOTO)", en: "LOTO applied" },
    { id: "zero_energy", ar: "التأكد من انعدام الطاقة (اختبار الجهد)", en: "Zero-energy verified (voltage test)" },
    { id: "insulated_tools", ar: "استخدام أدوات معزولة كهربائياً", en: "Insulated tools used" },
    { id: "arc_flash_ppe", ar: "معدات الحماية من القوس الكهربائي", en: "Arc-flash PPE worn" },
  ],
  excavation: [
    { id: "utilities_located", ar: "تحديد الخدمات المدفونة قبل الحفر", en: "Buried utilities located" },
    { id: "shoring", ar: "دعم/تدعيم جوانب الحفرة", en: "Trench shoring in place" },
    { id: "access_egress", ar: "توفير مداخل ومخارج آمنة", en: "Safe access/egress provided" },
    { id: "spoil_distance", ar: "إبعاد ناتج الحفر عن الحافة", en: "Spoil kept away from edge" },
  ],
  cold_work: [
    { id: "tools_inspected", ar: "فحص العدد والأدوات قبل البدء", en: "Tools inspected before use" },
    { id: "housekeeping", ar: "ترتيب ونظافة موقع العمل", en: "Good housekeeping maintained" },
  ],
  lifting: [
    { id: "crane_cert", ar: "شهادة فحص الرافعة سارية", en: "Crane inspection certificate valid" },
    { id: "rigging_inspected", ar: "فحص معدات الرفع والتسليط", en: "Rigging gear inspected" },
    { id: "load_chart", ar: "التقيّد بجدول الأحمال", en: "Load chart adhered to" },
    { id: "exclusion_zone", ar: "تحديد منطقة حظر تحت الحمل", en: "Exclusion zone under load" },
  ],
}

export function checklistForType(id: string | null | undefined): ChecklistItem[] {
  const type = getPermitType(id)
  return [...COMMON_CHECKLIST, ...(TYPE_CHECKLIST[type.id] ?? [])]
}

// قياسات الغاز المطلوبة للأنواع التي تتطلب فحص غاز.
export const GAS_FIELDS: { id: string; ar: string; en: string; unit: string; safe: string }[] = [
  { id: "o2", ar: "الأكسجين O₂", en: "Oxygen O₂", unit: "%", safe: "19.5–23.5" },
  { id: "lel", ar: "الغازات القابلة للاشتعال LEL", en: "Flammable LEL", unit: "%", safe: "< 10" },
  { id: "h2s", ar: "كبريتيد الهيدروجين H₂S", en: "Hydrogen sulfide H₂S", unit: "ppm", safe: "< 10" },
  { id: "co", ar: "أول أكسيد الكربون CO", en: "Carbon monoxide CO", unit: "ppm", safe: "< 35" },
]

// ================= الترقيم =================
export function buildPermitNumber(typeId: string, seq: number, year = new Date().getFullYear()): string {
  const t = getPermitType(typeId)
  return `${t.prefix}-${year}-${String(seq).padStart(3, "0")}`
}

// ================= الوقت المتبقي =================
export interface RemainingTime {
  expired: boolean
  totalMs: number
  hours: number
  minutes: number
  // نسبة الوقت المستهلك 0..1 لعرض شريط تقدّم.
  elapsedRatio: number
}

export function remainingTime(startAt: Date | string | null, endAt: Date | string | null, now = new Date()): RemainingTime | null {
  if (!endAt) return null
  const end = new Date(endAt).getTime()
  const start = startAt ? new Date(startAt).getTime() : now.getTime()
  const nowMs = now.getTime()
  const totalMs = Math.max(0, end - nowMs)
  const span = Math.max(1, end - start)
  const elapsedRatio = Math.min(1, Math.max(0, (nowMs - start) / span))
  return {
    expired: nowMs >= end,
    totalMs,
    hours: Math.floor(totalMs / 3_600_000),
    minutes: Math.floor((totalMs % 3_600_000) / 60_000),
    elapsedRatio,
  }
}

// أدوار سلسلة الاعتماد وتوقيعات الإغلاق.
export const SIGN_ROLES = {
  requester: { ar: "مسؤول الورشة", en: "Workshop manager" },
  issuer: { ar: "مشرف الورشة", en: "Workshop supervisor" },
  safety: { ar: "مشرف السلامة", en: "Safety supervisor" },
  approver: { ar: "مسؤول السلامة", en: "Safety officer" },
  closeIssuer: { ar: "منفذ العمل", en: "Work executor" },
  closeReceiver: { ar: "مسؤول السلامة", en: "Safety officer" },
} as const

export type SignRole = keyof typeof SIGN_ROLES
