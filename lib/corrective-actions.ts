// مصدر واحد للحقيقة لدلالات الإجراءات التصحيحية (CAPA): توحيد قيم الحالة، اشتقاق
// "المفتوح/المغلق/المتأخر"، وترتيب الأولوية. آمن للاستيراد من الخادم والعميل معاً
// (لا يعتمد على أي وحدة خادمية).

export const ACTION_STATUSES = ["open", "in_progress", "completed", "cancelled", "overdue"] as const
export type ActionStatus = (typeof ACTION_STATUSES)[number]

// أنواع مصدر الإجراء التصحيحي (السجل الأصلي الذي ولّده).
export const ACTION_SOURCE_TYPES = ["incident", "violation", "risk", "audit", "manual"] as const
export type ActionSourceType = (typeof ACTION_SOURCE_TYPES)[number]

// دالة التطبيع: تقبل القيم الإنجليزية الحديثة، والعربية القديمة، والمرادفات القديمة
// (مثل "closed" التي كانت تُكتب قبل توحيد المفردات)، وتُرجع دائماً قيمة enum واحدة.
export function normalizeActionStatus(raw: string | null | undefined): ActionStatus {
  const v = (raw ?? "").trim().toLowerCase()
  switch (v) {
    case "open":
    case "مفتوح":
    case "مفتوحة":
      return "open"
    case "in_progress":
    case "in progress":
    case "قيد التنفيذ":
    case "قيد المعالجة":
    case "investigating":
    case "قيد التحقيق":
      return "in_progress"
    case "completed":
    case "complete":
    case "done":
    case "closed":
    case "مكتمل":
    case "مكتملة":
    case "مغلق":
    case "مغلقة":
      return "completed"
    case "cancelled":
    case "canceled":
    case "ملغي":
    case "ملغى":
    case "ملغاة":
      return "cancelled"
    case "overdue":
    case "متأخر":
    case "متأخرة":
      return "overdue"
    default:
      return "open"
  }
}

// المغلق = مكتمل أو ملغى فقط. أي حالة أخرى (بما فيها "متأخر") تُعدّ مفتوحة.
const CLOSED_STATUSES = new Set<ActionStatus>(["completed", "cancelled"])

export function isActionClosed(status: string | null | undefined): boolean {
  return CLOSED_STATUSES.has(normalizeActionStatus(status))
}

export function isActionOpen(status: string | null | undefined): boolean {
  return !isActionClosed(status)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// متأخر = إجراء مفتوح تجاوز تاريخ استحقاقه. الإجراءات المغلقة لا تكون متأخرة أبداً.
export function isActionOverdue(dueDate: string | null | undefined, status: string | null | undefined): boolean {
  if (isActionClosed(status)) return false
  if (!dueDate) return false
  return dueDate < todayISO()
}

// ترتيب الأولوية للفرز (الأصغر = الأعلى أهمية). يقبل مفردات الخطورة نفسها.
const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
export function priorityRank(priority: string | null | undefined): number {
  return PRIORITY_RANK[(priority ?? "").trim().toLowerCase()] ?? 2
}

// تاريخ الاستحقاق الافتراضي حسب الأولوية (بند 10.2): حرجة 7 أيام، عالية 14، غير ذلك 30.
export function dueDaysForPriority(priority: string | null | undefined): number {
  const p = (priority ?? "").trim().toLowerCase()
  if (p === "critical") return 7
  if (p === "high") return 14
  return 30
}

// مقارنة الفرز للودجت: المتأخر أولاً، ثم الأعلى خطورة، ثم الأقدم استحقاقاً.
export function compareActionPriority(
  a: { dueDate: string | null; status: string | null; priority: string | null },
  b: { dueDate: string | null; status: string | null; priority: string | null },
): number {
  const ao = isActionOverdue(a.dueDate, a.status) ? 0 : 1
  const bo = isActionOverdue(b.dueDate, b.status) ? 0 : 1
  if (ao !== bo) return ao - bo
  const pr = priorityRank(a.priority) - priorityRank(b.priority)
  if (pr !== 0) return pr
  return (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99")
}

// رابط السجل الأصلي حسب نوع المصدر (صفحات القوائم؛ لا توجد صفحات تفاصيل مستقلة).
export function sourceHref(sourceType: string | null | undefined): string | null {
  switch (sourceType) {
    case "incident":
      return "/incidents"
    case "violation":
      return "/violations"
    case "risk":
      return "/risks"
    case "audit":
      return "/audits"
    default:
      return null
  }
}

// درجة الخطر (احتمالية × شدة). عتبة الربط التلقائي للمخاطر = 15 (البند الأحمر في مصفوفة 5×5).
export const RISK_ACTION_THRESHOLD = 15
// عتبة عدم المطابقة في التدقيق: نتيجة أقل من 80% لتدقيق مكتمل تُعدّ عدم مطابقة.
export const AUDIT_NONCONFORMITY_SCORE = 80
