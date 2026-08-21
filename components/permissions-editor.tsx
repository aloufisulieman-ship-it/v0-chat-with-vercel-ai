"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { moduleOptions } from "@/lib/labels"
import { useI18n } from "@/lib/i18n/client"
import { moduleLabel } from "@/lib/i18n/labels"

export function PermissionsEditor({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const { t } = useI18n()
  const allValues = moduleOptions.map((m) => m.value as string)
  const allChecked = allValues.every((v) => value.includes(v))

  function toggle(module: string, checked: boolean) {
    if (checked) {
      onChange(Array.from(new Set([...value, module])))
    } else {
      onChange(value.filter((v) => v !== module))
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{t("usersManager.choosePages")}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => onChange(allChecked ? [] : [...allValues])}
        >
          {allChecked ? t("usersManager.deselectAll") : t("usersManager.selectAll")}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 p-3 sm:grid-cols-3">
        {moduleOptions.map((m) => (
          <label
            key={m.value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
          >
            <Checkbox
              checked={value.includes(m.value)}
              onCheckedChange={(c) => toggle(m.value, !!c)}
              aria-label={moduleLabel(t, m.value)}
            />
            <span className="text-foreground">{moduleLabel(t, m.value)}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
