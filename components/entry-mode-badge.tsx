"use client"

import { Monitor, FileText } from "lucide-react"
import { useI18n } from "@/lib/i18n/client"

// شارة تميّز مصدر إدخال المخالفة: يدوية (نموذج ورقي) أو إلكترونية (عبر النظام).
export function EntryModeBadge({ entryMode }: { entryMode: string | null | undefined }) {
  const { t } = useI18n()
  const isManual = entryMode === "manual"
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isManual ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"
      }`}
    >
      {isManual ? <FileText className="size-3" /> : <Monitor className="size-3" />}
      {isManual ? t("badges.entryManual") : t("badges.entryElectronic")}
    </span>
  )
}
