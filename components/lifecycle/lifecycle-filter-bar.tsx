"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DEPTS,
  LIFECYCLE_STATUSES,
  deptLabel,
  lifecycleLabel,
  lifecycleUi,
  sourceLabel,
  type LifecycleStatus,
} from "@/lib/lifecycle"

type L = "ar" | "en"

// شريط الفلاتر لجداول المخالفات/الحوادث: تبويبات الحالة + فلتر الجهة + فلتر المصدر.
// الحالة تُخزَّن في عنوان الصفحة (searchParams) ويقوم الخادم بالتصفية.
export function LifecycleFilterBar({
  locale = "ar",
  counts,
  status,
  dept,
  source,
}: {
  locale?: L
  counts: Record<LifecycleStatus | "all", number>
  status: string
  dept: string
  source: string
}) {
  const s = lifecycleUi(locale)
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (!value || value === "all") next.delete(key)
    else next.set(key, value)
    const q = next.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <Tabs value={status || "all"} onValueChange={(v) => setParam("status", v)}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all" className="gap-1.5">
            {s.all}
            <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{counts.all}</span>
          </TabsTrigger>
          {LIFECYCLE_STATUSES.map((st) => (
            <TabsTrigger key={st} value={st} className="gap-1.5">
              {lifecycleLabel(st, locale)}
              <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{counts[st]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={dept || "all"} onValueChange={(v) => setParam("dept", v)}>
          <SelectTrigger className="h-9 w-40" aria-label={s.filterDept}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {s.filterDept}: {s.any}
            </SelectItem>
            {DEPTS.map((d) => (
              <SelectItem key={d} value={d}>
                {deptLabel(d, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source || "all"} onValueChange={(v) => setParam("source", v)}>
          <SelectTrigger className="h-9 w-40" aria-label={s.filterSource}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {s.filterSource}: {s.any}
            </SelectItem>
            <SelectItem value="ai_detection">{sourceLabel("ai_detection", locale)}</SelectItem>
            <SelectItem value="manual">{sourceLabel("manual", locale)}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
