// دورة الحياة الموحّدة للمخالفات والحوادث — النوع، الانتقالات المسموحة، والتسميات.
// مشترك بين الخادم والعميل (لا يستورد شيئاً من قاعدة البيانات).

export type LifecycleStatus = "new" | "referred" | "in_progress" | "closed" | "archived"
export type RecordSource = "ai_detection" | "manual"
export type Dept = "hr" | "finance"
export type LifecycleModule = "violations" | "incidents"
export type LifecycleEvent =
  | "created"
  | "converted_from_ai"
  | "referred"
  | "in_progress"
  | "closed"
  | "archived"
  | "reopened"

export const LIFECYCLE_STATUSES: LifecycleStatus[] = ["new", "referred", "in_progress", "closed", "archived"]
export const DEPTS: Dept[] = ["hr", "finance"]

type L = "ar" | "en"

export function normalizeLifecycle(v: string | null | undefined): LifecycleStatus {
  return (LIFECYCLE_STATUSES as string[]).includes(v ?? "") ? (v as LifecycleStatus) : "new"
}

export function isArchived(r: { lifecycleStatus?: string | null }): boolean {
  return normalizeLifecycle(r.lifecycleStatus) === "archived"
}

// قاعدة القفل: المؤرشف للقراءة فقط (يبقى PDF/البريد/الطباعة). إعادة الفتح للأدمن فقط.
export function canEditRecord(r: { lifecycleStatus?: string | null }): boolean {
  return !isArchived(r)
}

// الانتقالات المسموحة (من → إلى). "closed" ينتقل إلى "archived" تلقائياً على الخادم.
const TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  new: ["referred", "in_progress", "closed"],
  referred: ["in_progress", "closed"],
  in_progress: ["closed"],
  closed: ["archived"],
  // المؤرشف مقفول: لا انتقالات عادية. إعادة الفتح مسار مستقل (reopenRecord، أدمن فقط)
  // لا يمرّ عبر canTransition كي لا تظهر "بدء المعالجة" على سجل مؤرشف.
  archived: [],
}

export function canTransition(from: LifecycleStatus, to: LifecycleStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function lifecycleLabel(s: LifecycleStatus, locale: L = "ar"): string {
  const ar: Record<LifecycleStatus, string> = {
    new: "جديدة",
    referred: "محالة",
    in_progress: "قيد المعالجة",
    closed: "مغلقة",
    archived: "مؤرشفة",
  }
  const en: Record<LifecycleStatus, string> = {
    new: "New",
    referred: "Referred",
    in_progress: "In progress",
    closed: "Closed",
    archived: "Archived",
  }
  return (locale === "en" ? en : ar)[s]
}

export function sourceLabel(s: RecordSource | string | null | undefined, locale: L = "ar"): string {
  const ai = s === "ai_detection"
  if (locale === "en") return ai ? "AI detection" : "Manual"
  return ai ? "رصد آلي" : "يدوي"
}

export function deptLabel(d: Dept | string | null | undefined, locale: L = "ar"): string {
  if (d === "hr") return locale === "en" ? "Human Resources" : "الموارد البشرية"
  if (d === "finance") return locale === "en" ? "Finance" : "المالية"
  return locale === "en" ? "Unassigned" : "غير محدد"
}

export function eventLabel(e: LifecycleEvent | string, locale: L = "ar"): string {
  const ar: Record<string, string> = {
    created: "إنشاء السجل",
    converted_from_ai: "تحويل من الرصد الآلي",
    referred: "إحالة",
    in_progress: "بدء المعالجة",
    closed: "إغلاق",
    archived: "أرشفة",
    reopened: "إعادة فتح",
  }
  const en: Record<string, string> = {
    created: "Record created",
    converted_from_ai: "Converted from AI detection",
    referred: "Referred",
    in_progress: "Processing started",
    closed: "Closed",
    archived: "Archived",
    reopened: "Reopened",
  }
  return (locale === "en" ? en : ar)[e] ?? e
}

// تصفية صفوف حسب searchParams (status/dept/source) وحساب عدّادات التبويبات.
export function applyLifecycleFilters<T extends { lifecycleStatus?: string | null; assignedDept?: string | null; source?: string | null }>(
  rows: T[],
  sp: { status?: string; dept?: string; source?: string },
) {
  const counts = { all: rows.length } as Record<LifecycleStatus | "all", number>
  for (const st of LIFECYCLE_STATUSES) counts[st] = 0
  for (const r of rows) counts[normalizeLifecycle(r.lifecycleStatus)]++

  const status = sp.status && (LIFECYCLE_STATUSES as string[]).includes(sp.status) ? sp.status : ""
  const dept = sp.dept && (DEPTS as string[]).includes(sp.dept) ? sp.dept : ""
  const source = sp.source === "ai_detection" || sp.source === "manual" ? sp.source : ""

  const filtered = rows.filter((r) => {
    if (status && normalizeLifecycle(r.lifecycleStatus) !== status) return false
    if (dept && (r.assignedDept ?? "") !== dept) return false
    if (source && (r.source ?? "manual") !== source) return false
    return true
  })
  return { filtered, counts, status, dept, source }
}

// ألوان شارات الحالة (Tailwind tokens فقط).
export function lifecycleBadgeClass(s: LifecycleStatus): string {
  switch (s) {
    case "new":
      return "bg-primary/10 text-primary border-primary/20"
    case "referred":
      return "bg-accent text-accent-foreground border-border"
    case "in_progress":
      return "bg-secondary text-secondary-foreground border-border"
    case "closed":
      return "bg-muted text-foreground border-border"
    case "archived":
      return "bg-muted text-muted-foreground border-border line-through-none"
  }
}

// تسميات واجهة مشتركة لمكوّنات دورة الحياة.
export function lifecycleUi(locale: L = "ar") {
  if (locale === "en") {
    return {
      all: "All",
      refer: "Refer",
      startProcessing: "Start processing",
      close: "Close",
      reopen: "Reopen",
      referTitle: "Refer record",
      referDesc: "Choose the responsible department. An internal notification is sent to it, and you can also email the report.",
      dept: "Department",
      notes: "Referral notes",
      dueDate: "Due date (optional)",
      alsoEmail: "Also send the report by email",
      closeTitle: "Close record",
      closeDesc: "Record the action taken. The record is archived automatically after closing.",
      closureAction: "Action taken (required)",
      evidence: "Evidence file (optional)",
      reopenTitle: "Reopen archived record",
      reopenDesc: "Admins only. A reason is required and is recorded in the timeline.",
      reopenReason: "Reopen reason (required)",
      timeline: "Timeline",
      details: "Details",
      archivedNotice: "This record is archived (read-only). You can export, print or email it.",
      cancel: "Cancel",
      confirm: "Confirm",
      saving: "Saving...",
      source: "Source",
      status: "Status",
      assignedTo: "Assigned to",
      referredToMe: "Referred to my department",
      by: "by",
      noEvents: "No events yet.",
      filterDept: "Department",
      filterSource: "Source",
      any: "Any",
    }
  }
  return {
    all: "الكل",
    refer: "إحالة",
    startProcessing: "بدء المعالجة",
    close: "إغلاق",
    reopen: "إعادة فتح",
    referTitle: "إحالة السجل",
    referDesc: "اختر الجهة المسؤولة. يُرسَل إشعار داخلي إليها، ويمكنك أيضاً إرسال التقرير بالبريد.",
    dept: "الجهة",
    notes: "ملاحظات الإحالة",
    dueDate: "تاريخ الاستحقاق (اختياري)",
    alsoEmail: "إرسال التقرير بالبريد أيضاً",
    closeTitle: "إغلاق السجل",
    closeDesc: "سجّل الإجراء المتخذ. يُؤرشَف السجل تلقائياً بعد ال��غلاق.",
    closureAction: "الإجراء المتخذ (إلزامي)",
    evidence: "ملف إثبات (اختياري)",
    reopenTitle: "إعادة فتح سجل مؤرشف",
    reopenDesc: "لمدير النظام فقط. السبب إلزامي ويُسجَّل في سجل الحركة.",
    reopenReason: "سبب إعادة الفتح (إلزامي)",
    timeline: "سجل الحركة",
    details: "التفاصيل",
    archivedNotice: "هذا السجل مؤرشف (قراءة فقط). يمكنك التصدير أو الطباعة أو الإرسال بالبريد.",
    cancel: "إلغاء",
    confirm: "تأكيد",
    saving: "جارٍ الحفظ...",
    source: "المصدر",
    status: "الحالة",
    assignedTo: "الجهة المحال إليها",
    referredToMe: "المحال إلى جهتي",
    by: "بواسطة",
    noEvents: "لا توجد أحداث بعد.",
    filterDept: "الجهة",
    filterSource: "المصدر",
    any: "أي",
  }
}
