"use client"

import { AlertTriangle, Bot, Lock, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  deptLabel,
  lifecycleBadgeClass,
  lifecycleLabel,
  lifecycleUi,
  normalizeLifecycle,
  sourceLabel,
  type Dept,
} from "@/lib/lifecycle"

type L = "ar" | "en"

// شارة حالة دورة الحياة (جديدة/محالة/قيد المعالجة/مغلقة/مؤرشفة). المؤرشفة تحمل رمز قفل.
export function LifecycleBadge({
  status,
  locale = "ar",
  className,
}: {
  status: string | null | undefined
  locale?: L
  className?: string
}) {
  const s = normalizeLifecycle(status)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        lifecycleBadgeClass(s),
        className,
      )}
    >
      {s === "archived" && <Lock className="size-3" aria-hidden />}
      {lifecycleLabel(s, locale)}
    </span>
  )
}

// شارة المصدر: رصد آلي (روبوت) أو إدخال يدوي.
export function SourceBadge({
  source,
  locale = "ar",
  className,
}: {
  source: string | null | undefined
  locale?: L
  className?: string
}) {
  const ai = source === "ai_detection"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground whitespace-nowrap",
        className,
      )}
    >
      {ai ? <Bot className="size-3" aria-hidden /> : <UserRound className="size-3" aria-hidden />}
      {sourceLabel(source, locale)}
    </span>
  )
}

// تاريخ الاستحقاق: يُلوَّن بالأحمر مع تنبيه إذا تجاوز اليوم وكان السجل لا يزال مفتوحاً
// (محال/قيد المعالجة). لا يُعتبر متأخراً بعد الإغلاق/الأرشفة.
export function DueDateBadge({
  dueDate,
  status,
  locale = "ar",
}: {
  dueDate: string | Date | null | undefined
  status: string | null | undefined
  locale?: L
}) {
  if (!dueDate) return <span className="text-xs text-muted-foreground">—</span>
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate
  if (Number.isNaN(d.getTime())) return <span className="text-xs text-muted-foreground">—</span>
  const s = normalizeLifecycle(status)
  const openStates = s === "referred" || s === "in_progress" || s === "new"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdue = openStates && d.getTime() < today.getTime()
  const text = d.toLocaleDateString(locale === "en" ? "en-GB" : "ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" })
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs whitespace-nowrap tabular-nums",
        overdue ? "border border-destructive/40 bg-destructive/10 font-medium text-destructive" : "text-foreground",
      )}
      title={overdue ? lifecycleUi(locale).overdue : undefined}
    >
      {overdue && <AlertTriangle className="size-3" aria-hidden />}
      {text}
      {overdue && <span className="sr-only">{lifecycleUi(locale).overdue}</span>}
    </span>
  )
}

// شارة الجهة المحال إليها.
export function DeptBadge({ dept, locale = "ar" }: { dept: Dept | string | null | undefined; locale?: L }) {
  if (!dept) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground whitespace-nowrap">
      {deptLabel(dept, locale)}
    </span>
  )
}
