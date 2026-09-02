"use client"

import type { ReactNode } from "react"
import { Ban, AlertTriangle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// تبويبان ثابتان للوحات الجهات (HR/المالية): المخالفات | الحوادث، مع عدّاد النشط لكل تبويب.
// المحتوى يُصيَّر على الخادم ويُمرَّر كأطفال — المكوّن مسؤول عن التبديل فقط.
export function DeptTabs({
  violationsLabel,
  incidentsLabel,
  violationsCount,
  incidentsCount,
  violations,
  incidents,
  defaultTab = "violations",
}: {
  violationsLabel: string
  incidentsLabel: string
  violationsCount: number
  incidentsCount: number
  violations: ReactNode
  incidents: ReactNode
  defaultTab?: "violations" | "incidents"
}) {
  return (
    <Tabs defaultValue={defaultTab} className="mt-8 flex flex-col gap-4">
      <TabsList className="h-auto w-full justify-start gap-1 rounded-lg bg-muted p-1 sm:w-auto">
        <TabsTrigger value="violations" className="flex-1 gap-2 px-4 py-2 sm:flex-none">
          <Ban className="size-4" aria-hidden />
          <span>{violationsLabel}</span>
          <Count n={violationsCount} />
        </TabsTrigger>
        <TabsTrigger value="incidents" className="flex-1 gap-2 px-4 py-2 sm:flex-none">
          <AlertTriangle className="size-4" aria-hidden />
          <span>{incidentsLabel}</span>
          <Count n={incidentsCount} />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="violations" className="mt-0">
        {violations}
      </TabsContent>
      <TabsContent value="incidents" className="mt-0">
        {incidents}
      </TabsContent>
    </Tabs>
  )
}

function Count({ n }: { n: number }) {
  return (
    <span
      className="inline-flex min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-semibold tabular-nums text-foreground"
      aria-label={String(n)}
    >
      {n}
    </span>
  )
}
