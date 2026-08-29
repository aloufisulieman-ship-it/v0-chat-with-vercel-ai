"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2, Save, SlidersHorizontal, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"
import { CategoryIcon } from "@/components/category-icon"
import { saveOperationalSettings } from "@/app/actions/org-settings"
import {
  MAX_GATES,
  CATEGORY_ICON_CHOICES,
  CATEGORY_COLOR_CHOICES,
  categoryColorStyle,
  type OperationalSettings,
  type Severity,
} from "@/lib/org-settings-shared"

type VForm = { key: string; label: string }
type VioForm = { key: string; label: string; severity: Severity }
type CatForm = { key: string; label: string; icon: string; color: string }

let counter = 0
const nextKey = () => `row-${counter++}`

export function OperationalSettingsForm({
  settings,
  readOnly,
}: {
  settings: OperationalSettings
  readOnly: boolean
}) {
  const { t } = useI18n()
  const [pending, start] = useTransition()

  const [entryGates, setEntryGates] = useState(settings.general.entryGateCount)
  const [exitGates, setExitGates] = useState(settings.general.exitGateCount)
  const [vehicles, setVehicles] = useState<VForm[]>(
    settings.vehicleTypes.map((v) => ({ key: nextKey(), label: v.label })),
  )
  const [violations, setViolations] = useState<VioForm[]>(
    settings.violationTypes.map((v) => ({ key: nextKey(), label: v.label, severity: v.severity })),
  )
  const [categories, setCategories] = useState<CatForm[]>(
    settings.inspectionCategories.map((c) => ({ key: nextKey(), label: c.label, icon: c.icon, color: c.color })),
  )

  const gateRange = Array.from({ length: MAX_GATES }, (_, i) => i + 1)

  function save() {
    start(async () => {
      const res = await saveOperationalSettings({
        general: { entryGateCount: entryGates, exitGateCount: exitGates },
        vehicleTypes: vehicles.map((v) => ({ label: v.label })),
        violationTypes: violations.map((v) => ({ label: v.label, severity: v.severity })),
        inspectionCategories: categories.map((c) => ({ label: c.label, icon: c.icon, color: c.color })),
      })
      if (res.ok) toast({ title: t("settingsPage.opsSaved") })
      else toast({ title: res.error || t("settingsPage.opsSaveFailed"), variant: "destructive" })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold text-foreground">{t("settingsPage.opsTitle")}</h3>
            <p className="text-xs text-muted-foreground text-pretty">{t("settingsPage.opsSubtitle")}</p>
          </div>
        </div>
        {!readOnly && (
          <Button onClick={save} disabled={pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {pending ? t("settingsPage.opsSaving") : t("settingsPage.opsSave")}
          </Button>
        )}
      </div>

      {readOnly && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <Lock className="size-4" />
          {t("settingsPage.opsReadOnly")}
        </div>
      )}

      <Tabs defaultValue="gates" className="gap-4">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="gates">{t("settingsPage.opsTabGates")}</TabsTrigger>
          <TabsTrigger value="vehicles">{t("settingsPage.opsTabVehicles")}</TabsTrigger>
          <TabsTrigger value="violations">{t("settingsPage.opsTabViolations")}</TabsTrigger>
          <TabsTrigger value="categories">{t("settingsPage.opsTabCategories")}</TabsTrigger>
        </TabsList>

        {/* البوابات */}
        <TabsContent value="gates" className="m-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <GateSelect
              label={t("settingsPage.opsEntryGates")}
              value={entryGates}
              onChange={setEntryGates}
              options={gateRange}
              disabled={readOnly}
            />
            <GateSelect
              label={t("settingsPage.opsExitGates")}
              value={exitGates}
              onChange={setExitGates}
              options={gateRange}
              disabled={readOnly}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t("settingsPage.opsGatesHint")}</p>
        </TabsContent>

        {/* أنواع المركبات */}
        <TabsContent value="vehicles" className="m-0">
          <ListEditor
            emptyLabel={t("settingsPage.opsEmpty")}
            addLabel={t("settingsPage.opsAdd")}
            readOnly={readOnly}
            onAdd={() => setVehicles((r) => [...r, { key: nextKey(), label: "" }])}
            rows={vehicles.map((v) => ({
              key: v.key,
              onRemove: () => setVehicles((r) => r.filter((x) => x.key !== v.key)),
              content: (
                <Input
                  value={v.label}
                  disabled={readOnly}
                  placeholder={t("settingsPage.opsLabelPlaceholder")}
                  onChange={(e) =>
                    setVehicles((r) => r.map((x) => (x.key === v.key ? { ...x, label: e.target.value } : x)))
                  }
                />
              ),
            }))}
          />
        </TabsContent>

        {/* أنواع المخالفات */}
        <TabsContent value="violations" className="m-0">
          <ListEditor
            emptyLabel={t("settingsPage.opsEmpty")}
            addLabel={t("settingsPage.opsAdd")}
            readOnly={readOnly}
            onAdd={() => setViolations((r) => [...r, { key: nextKey(), label: "", severity: "medium" }])}
            rows={violations.map((v) => ({
              key: v.key,
              onRemove: () => setViolations((r) => r.filter((x) => x.key !== v.key)),
              content: (
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <Input
                    className="flex-1"
                    value={v.label}
                    disabled={readOnly}
                    placeholder={t("settingsPage.opsLabelPlaceholder")}
                    onChange={(e) =>
                      setViolations((r) => r.map((x) => (x.key === v.key ? { ...x, label: e.target.value } : x)))
                    }
                  />
                  <Select
                    value={v.severity}
                    disabled={readOnly}
                    onValueChange={(val) =>
                      setViolations((r) =>
                        r.map((x) => (x.key === v.key ? { ...x, severity: val as Severity } : x)),
                      )
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("settingsPage.opsSeverityLow")}</SelectItem>
                      <SelectItem value="medium">{t("settingsPage.opsSeverityMedium")}</SelectItem>
                      <SelectItem value="high">{t("settingsPage.opsSeverityHigh")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ),
            }))}
          />
        </TabsContent>

        {/* فئات الجولة */}
        <TabsContent value="categories" className="m-0">
          <ListEditor
            emptyLabel={t("settingsPage.opsEmpty")}
            addLabel={t("settingsPage.opsAdd")}
            readOnly={readOnly}
            onAdd={() =>
              setCategories((r) => [...r, { key: nextKey(), label: "", icon: "clipboard-check", color: "blue" }])
            }
            rows={categories.map((c) => {
              const style = categoryColorStyle(c.color)
              return {
                key: c.key,
                onRemove: () => setCategories((r) => r.filter((x) => x.key !== c.key)),
                content: (
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: style.bg, color: style.color }}
                      aria-hidden
                    >
                      <CategoryIcon name={c.icon} className="size-5" />
                    </span>
                    <Input
                      className="flex-1"
                      value={c.label}
                      disabled={readOnly}
                      placeholder={t("settingsPage.opsLabelPlaceholder")}
                      onChange={(e) =>
                        setCategories((r) => r.map((x) => (x.key === c.key ? { ...x, label: e.target.value } : x)))
                      }
                    />
                    <Select
                      value={c.icon}
                      disabled={readOnly}
                      onValueChange={(val) =>
                        setCategories((r) => r.map((x) => (x.key === c.key ? { ...x, icon: val } : x)))
                      }
                    >
                      <SelectTrigger className="w-full sm:w-[120px]" aria-label={t("settingsPage.opsIcon")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_ICON_CHOICES.map((ic) => (
                          <SelectItem key={ic} value={ic}>
                            <span className="flex items-center gap-2">
                              <CategoryIcon name={ic} className="size-4" />
                              {ic}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={c.color}
                      disabled={readOnly}
                      onValueChange={(val) =>
                        setCategories((r) => r.map((x) => (x.key === c.key ? { ...x, color: val } : x)))
                      }
                    >
                      <SelectTrigger className="w-full sm:w-[120px]" aria-label={t("settingsPage.opsColor")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_COLOR_CHOICES.map((col) => (
                          <SelectItem key={col.value} value={col.value}>
                            <span className="flex items-center gap-2">
                              <span
                                className="size-3.5 rounded-full"
                                style={{ backgroundColor: col.color }}
                                aria-hidden
                              />
                              {col.value}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ),
              }
            })}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function GateSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  options: number[]
  disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm">{label}</Label>
      <Select value={String(value)} disabled={disabled} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ListEditor({
  rows,
  onAdd,
  addLabel,
  emptyLabel,
  readOnly,
}: {
  rows: { key: string; content: React.ReactNode; onRemove: () => void }[]
  onAdd: () => void
  addLabel: string
  emptyLabel: string
  readOnly: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pl-1">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
              <div className="flex flex-1 items-center">{row.content}</div>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn("shrink-0 text-muted-foreground hover:text-destructive")}
                  onClick={row.onRemove}
                  aria-label={t("settingsPage.opsRemove")}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <Button type="button" variant="outline" onClick={onAdd} className="mt-1 gap-2 self-start bg-transparent">
          <Plus className="size-4" />
          {addLabel}
        </Button>
      )}
    </div>
  )
}
