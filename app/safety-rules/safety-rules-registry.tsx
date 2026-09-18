"use client"

import { useActionState, useMemo, useRef, useState } from "react"
import { Pencil, Plus, Trash2, ShieldAlert, Search, ArrowUp, ArrowDown, Camera, FileDown, ChevronDown, ChevronUp } from "lucide-react"
import { createSafetyRule, deleteSafetyRule, updateSafetyRule, moveSafetyRule } from "@/app/actions/equipment"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useI18n } from "@/lib/i18n/client"
import { useIsAuditor } from "@/components/user-role-context"
import { downloadElementPdf } from "@/lib/pdf"

export type SafetyRuleRecord = {
  id: number
  location: string
  rules: string
  cameraRules: string
  active: boolean
}

type RuleAction = (formData: FormData) => Promise<void>

function fmt(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), template)
}

// يحلّل نصاً مرقَّماً (سطر واحد لكل قاعدة، "1. النص") إلى أرقام ونصوص. سطر بلا
// ترقيم يُعرض كما هو برقم غير معروف (لا يُطابَق مع camera_rules حينها).
function parseNumbered(text: string): { num: number | null; text: string }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\d+)\.\s*(.*)$/)
      return m ? { num: Number(m[1]), text: m[2] } : { num: null, text: line }
    })
}

function RuleDialog({ item }: { item?: SafetyRuleRecord }) {
  const { t, dir } = useI18n()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(item?.active ?? true)
  const action: RuleAction = item ? updateSafetyRule : createSafetyRule
  const [, formAction, pending] = useActionState(async (_: null, formData: FormData) => {
    await action(formData)
    setOpen(false)
    return null
  }, null)

  // المدقق لا يملك هذا الإجراء — والخادم يرفضه أيضاً.
  const isAuditor = useIsAuditor()
  if (isAuditor) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="icon" aria-label={t("safetyRules.editAria").replace("{location}", item.location)}><Pencil /></Button>
        ) : (
          <Button><Plus data-icon="inline-start" />{t("safetyRules.addRule")}</Button>
        )}
      </DialogTrigger>
      <DialogContent dir={dir}>
        <DialogHeader>
          <DialogTitle>{item ? t("safetyRules.dialogEditTitle") : t("safetyRules.dialogAddTitle")}</DialogTitle>
          <DialogDescription>{t("safetyRules.dialogDesc")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {item && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="active" value={String(active)} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`sr-location-${item?.id ?? "new"}`}>{t("safetyRules.fLocation")}</Label>
            <Input id={`sr-location-${item?.id ?? "new"}`} name="location" defaultValue={item?.location} required placeholder={t("safetyRules.fLocationPlaceholder")} />
            <span className="text-xs text-muted-foreground">{t("safetyRules.fLocationHint")}</span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`sr-rules-${item?.id ?? "new"}`}>{t("safetyRules.fRules")}</Label>
            <Textarea id={`sr-rules-${item?.id ?? "new"}`} name="rules" defaultValue={item?.rules} rows={7} placeholder={t("safetyRules.fRulesPlaceholder")} />
            <span className="text-xs text-muted-foreground">{t("safetyRules.fRulesHint")}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`sr-active-${item?.id ?? "new"}`}>{t("safetyRules.fStatus")}</Label>
              <span className="text-sm text-muted-foreground">{t("safetyRules.activeHint")}</span>
            </div>
            <Switch id={`sr-active-${item?.id ?? "new"}`} checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter><Button type="submit" disabled={pending}>{pending ? t("safetyRules.saving") : t("safetyRules.save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteRuleButton({ item }: { item: SafetyRuleRecord }) {
  const { t, dir } = useI18n()
  // المدقق لا يملك هذا الإجراء — والخادم يرفضه أيضاً.
  const isAuditor = useIsAuditor()
  if (isAuditor) return null

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={t("safetyRules.deleteAria").replace("{location}", item.location)}><Trash2 /></Button></AlertDialogTrigger>
      <AlertDialogContent dir={dir}>
        <AlertDialogHeader><AlertDialogTitle>{t("safetyRules.deleteTitle")}</AlertDialogTitle><AlertDialogDescription>{t("safetyRules.deleteDesc").replace("{location}", item.location)}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("safetyRules.cancel")}</AlertDialogCancel>
          <form action={deleteSafetyRule}><input type="hidden" name="id" value={item.id} /><AlertDialogAction type="submit">{t("safetyRules.confirmDelete")}</AlertDialogAction></form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function MoveButtons({ item, disableUp, disableDown }: { item: SafetyRuleRecord; disableUp: boolean; disableDown: boolean }) {
  const { t } = useI18n()
  const isAuditor = useIsAuditor()
  const [pending, setPending] = useState<"up" | "down" | null>(null)
  if (isAuditor) return null

  async function move(direction: "up" | "down") {
    setPending(direction)
    const fd = new FormData()
    fd.set("id", String(item.id))
    fd.set("direction", direction)
    try {
      await moveSafetyRule(fd)
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        disabled={disableUp || pending !== null}
        aria-label={fmt(t("safetyRules.moveUpAria"), { location: item.location })}
        onClick={() => move("up")}
      >
        <ArrowUp className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        disabled={disableDown || pending !== null}
        aria-label={fmt(t("safetyRules.moveDownAria"), { location: item.location })}
        onClick={() => move("down")}
      >
        <ArrowDown className="size-3.5" />
      </Button>
    </div>
  )
}

function PrintLocationButton({ item, rules }: { item: SafetyRuleRecord; rules: { num: number | null; text: string }[] }) {
  const { t, dir } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const cameraNums = useMemo(() => new Set(parseNumbered(item.cameraRules).map((r) => r.num).filter((n): n is number => n !== null)), [item.cameraRules])

  async function handlePrint() {
    if (!ref.current) return
    setBusy(true)
    try {
      await downloadElementPdf(ref.current, `${t("safetyRules.printFileName")}-${item.location}`, { singlePage: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={handlePrint} disabled={busy} aria-label={fmt(t("safetyRules.printAria"), { location: item.location })}>
        <FileDown className="size-4" />
      </Button>
      {/* منطقة الطباعة خارج الشاشة — لوحة A4 بخلفية بيضاء ونص داكن. */}
      <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
        <div ref={ref} dir={dir} style={{ width: 760, padding: 32, background: "#ffffff", color: "#0f172a", fontFamily: "sans-serif" }}>
          <div style={{ borderBottom: "2px solid #0f172a", paddingBottom: 12, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{item.location}</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
              {t("safetyRules.printGeneratedAt")}: {new Date().toLocaleDateString()}
              {"  ·  "}
              {t("safetyRules.printTotalRules")}: {rules.length}
              {"  ·  "}
              {t("safetyRules.printCameraRules")}: {cameraNums.size}
            </div>
          </div>
          <ol style={{ margin: 0, paddingInlineStart: 20, fontSize: 13, lineHeight: 1.9 }}>
            {rules.map((r, i) => (
              <li key={i}>
                {r.text}
                {r.num !== null && cameraNums.has(r.num) ? " 📷" : ""}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  )
}

function RuleCard({
  item,
  disableUp,
  disableDown,
}: {
  item: SafetyRuleRecord
  disableUp: boolean
  disableDown: boolean
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)

  const rules = useMemo(() => parseNumbered(item.rules), [item.rules])
  const cameraNums = useMemo(() => new Set(parseNumbered(item.cameraRules).map((r) => r.num).filter((n): n is number => n !== null)), [item.cameraRules])
  const visibleRules = expanded ? rules : rules.slice(0, 3)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <MoveButtons item={item} disableUp={disableUp} disableDown={disableDown} />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-foreground">{item.location}</h3>
              <Badge variant={item.active ? "default" : "secondary"}>{item.active ? t("safetyRules.statusActive") : t("safetyRules.statusInactive")}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{fmt(t("safetyRules.ruleCount"), { count: rules.length })}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1"><Camera className="size-3" />{fmt(t("safetyRules.cameraCount"), { count: cameraNums.size })}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <PrintLocationButton item={item} rules={rules} />
          <RuleDialog item={item} />
          <DeleteRuleButton item={item} />
        </div>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">-</p>
      ) : (
        <>
          <ol className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {visibleRules.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="shrink-0 text-foreground">{r.num ?? i + 1}.</span>
                <span className="flex-1">{r.text}</span>
                {r.num !== null && cameraNums.has(r.num) && (
                  <span title={t("safetyRules.cameraIconTitle")} className="mt-0.5 shrink-0">
                    <Camera className="size-3.5 text-primary" />
                  </span>
                )}
              </li>
            ))}
          </ol>
          {rules.length > 3 && (
            <Button variant="ghost" size="sm" className="w-fit" onClick={() => setExpanded((v) => !v)}>
              {expanded ? (
                <>{t("safetyRules.showLess")}<ChevronUp data-icon="inline-end" /></>
              ) : (
                <>{fmt(t("safetyRules.showAll"), { count: rules.length })}<ChevronDown data-icon="inline-end" /></>
              )}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

export function SafetyRulesRegistry({ items }: { items: SafetyRuleRecord[] }) {
  const { t, dir } = useI18n()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all")
  const isUnfiltered = search.trim() === "" && status === "all"

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (status === "active" && !item.active) return false
      if (status === "inactive" && item.active) return false
      if (q && !item.location.toLowerCase().includes(q) && !item.rules.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, search, status])

  return (
    <section className="flex flex-col gap-4" dir={dir}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("safetyRules.searchPlaceholder")} className="ps-9" />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("safetyRules.filterStatusAll")}</SelectItem>
              <SelectItem value="active">{t("safetyRules.filterStatusActive")}</SelectItem>
              <SelectItem value="inactive">{t("safetyRules.filterStatusInactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <RuleDialog />
      </div>

      {items.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-border text-muted-foreground">
          <ShieldAlert className="size-6" />
          <span>{t("safetyRules.empty")}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-border text-muted-foreground">
          <Search className="size-6" />
          <span>{t("safetyRules.noResults")}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((item, i) => (
            <RuleCard
              key={item.id}
              item={item}
              // إعادة الترتيب تُبدّل الموقع بجاره في القائمة الكاملة على الخادم؛ تُعطَّل
              // أثناء البحث/الفلترة لأن الجار في القائمة المفلترة قد لا يكون الجار
              // الفعلي في الترتيب الكامل.
              disableUp={i === 0 || !isUnfiltered}
              disableDown={i === filtered.length - 1 || !isUnfiltered}
            />
          ))}
        </div>
      )}
    </section>
  )
}
