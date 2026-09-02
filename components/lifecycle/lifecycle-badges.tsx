"use client"

import { Bot, Lock, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  deptLabel,
  lifecycleBadgeClass,
  lifecycleLabel,
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

// شارة الجهة المحال إليها.
export function DeptBadge({ dept, locale = "ar" }: { dept: Dept | string | null | undefined; locale?: L }) {
  if (!dept) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground whitespace-nowrap">
      {deptLabel(dept, locale)}
    </span>
  )
}
