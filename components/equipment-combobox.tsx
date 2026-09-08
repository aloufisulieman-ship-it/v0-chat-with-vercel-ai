"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Truck, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { equipmentTypeLabels } from "@/lib/labels"
import { useI18n } from "@/lib/i18n/client"

export type EquipmentOption = {
  id: number
  fleetNo: string
  plateNumber: string
  equipmentType: string
  active: boolean
}

// حقل اختيار المعدة القابل للبحث. يخزّن المعرّف في input مخفي باسم `name` (افتراضياً
// equipmentId) لإرساله مع النموذج. الاختيار اختياري (يمكن إلغاؤه ليبقى null).
export function EquipmentCombobox({
  options,
  name = "equipmentId",
  defaultValue,
  label,
  onChange,
}: {
  options: EquipmentOption[]
  name?: string
  defaultValue?: number | null
  label?: string
  // عند تمريرها يعمل المكوّن في وضع التحكّم الخارجي (للنماذج التي تبني FormData يدوياً).
  onChange?: (id: number | null) => void
}) {
  const { t, dir } = useI18n()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<number | null>(defaultValue ?? null)

  function select(id: number | null) {
    setValue(id)
    onChange?.(id)
  }

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value])
  const display = (o: EquipmentOption) => {
    const id = o.fleetNo || o.plateNumber || `#${o.id}`
    const type = equipmentTypeLabels[o.equipmentType] || o.equipmentType
    return `${id} — ${type}`
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label ?? t("equipmentCombobox.label")}</span>
      <input type="hidden" name={name} value={value ?? ""} />
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="flex-1 justify-between font-normal">
              <span className="flex items-center gap-2 truncate">
                <Truck className="size-4 text-muted-foreground" />
                {selected ? display(selected) : <span className="text-muted-foreground">{t("equipmentCombobox.placeholder")}</span>}
              </span>
              <ChevronsUpDown className="size-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" dir={dir}>
            <Command>
              <CommandInput placeholder={t("equipmentCombobox.search")} />
              <CommandList>
                <CommandEmpty>{t("equipmentCombobox.empty")}</CommandEmpty>
                <CommandGroup>
                  {options.map((o) => (
                    <CommandItem
                      key={o.id}
                      value={`${o.fleetNo} ${o.plateNumber} ${equipmentTypeLabels[o.equipmentType] || o.equipmentType}`}
                      onSelect={() => {
                        select(o.id === value ? null : o.id)
                        setOpen(false)
                      }}
                    >
                      <Check className={cn("size-4", o.id === value ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{display(o)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selected && (
          <Button type="button" variant="ghost" size="icon" aria-label={t("equipmentCombobox.clear")} onClick={() => select(null)}>
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
