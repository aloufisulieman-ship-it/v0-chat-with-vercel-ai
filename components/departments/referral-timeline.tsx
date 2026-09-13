"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Printer, PenLine, Clock, Building2, Undo2, CheckCircle2 } from "lucide-react"
import { correctReferral } from "@/app/actions/referrals"
import { sourceTypeLabels, type ReferralSourceType } from "@/lib/departments"

type TimelineEvent = {
  id: number
  action: string
  actorName: string
  actorRole: string
  actorDept: string
  stageDeptName: string
  fromStatus: string
  toStatus: string
  comment: string
  createdAt: string
}

type Summary = {
  firstCreatedAt: string
  endedAt: string
  closed: boolean
  totalMs: number
  deptCount: number
  returnCount: number
  dueAt: string | null
  lateHours: number
  withinSla: boolean
}

type ChainDept = { refNo: string; code: string; nameAr: string; status: string }

type Props = {
  referral: { id: number; refNo: string; sourceType: string; sourceId: number; status: string; priority: string }
  events: TimelineEvent[]
  chainDepts: ChainDept[]
  summary: Summary
  orgName: string
}

const actionLabels: Record<string, string> = {
  created: "أُنشئ السجل",
  acknowledged: "استُلم / اطُّلع عليه",
  assigned: "أُسند إلى موظف",
  in_progress: "بدأت المعالجة",
  returned: "أُعيد مع السبب",
  reassigned: "أُعيد التحويل",
  correction: "تصحيح",
  closed: "أُغلق بالتوقيع",
  archived: "أُرشف",
  comment: "تعليق",
}

// فئة اللون: كهرماني للإرجاع/التصحيح، أخضر للإغلاق، رمادي للبقية.
function toneOf(action: string): "amber" | "green" | "gray" {
  if (action === "returned" || action === "correction") return "amber"
  if (action === "closed") return "green"
  return "gray"
}

const dotTone: Record<"amber" | "green" | "gray", string> = {
  amber: "bg-amber-500 ring-amber-500/20",
  green: "bg-emerald-600 ring-emerald-600/20",
  gray: "bg-muted-foreground ring-muted-foreground/20",
}

// التاريخ بالتقويم الميلادي وصيغة 24 ساعة.
function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    calendar: "gregory",
  })
  const time = d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: false })
  return `${date} — ${time}`
}

// المدة المنقضية بصيغة "بعد X ي Y س Z د".
function fmtElapsed(ms: number): string {
  if (ms < 60_000) return "بعد لحظات"
  const mins = Math.floor(ms / 60_000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  const parts: string[] = []
  if (days) parts.push(`${days} ي`)
  if (hours) parts.push(`${hours} س`)
  if (m && !days) parts.push(`${m} د`)
  return `بعد ${parts.join(" ") || "لحظات"}`
}

function fmtDuration(ms: number): string {
  const mins = Math.floor(ms / 60_000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  const parts: string[] = []
  if (days) parts.push(`${days} يوم`)
  if (hours) parts.push(`${hours} ساعة`)
  if (m && !days) parts.push(`${m} دقيقة`)
  return parts.join(" و") || "أقل من دقيقة"
}

export function ReferralTimeline({ referral, events, chainDepts, summary, orgName }: Props) {
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [printing, setPrinting] = useState(false)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  async function printPdf() {
    if (!printRef.current) return
    setPrinting(true)
    try {
      const { downloadElementPdf } = await import("@/lib/pdf")
      await downloadElementPdf(printRef.current, `مسار-${referral.refNo}`, { singlePage: true })
    } finally {
      setPrinting(false)
    }
  }

  function submitCorrection() {
    setError("")
    startTransition(async () => {
      try {
        await correctReferral(referral.id, text)
        setOpen(false)
        setText("")
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر حفظ التصحيح")
      }
    })
  }

  const sourceLabel = sourceTypeLabels[referral.sourceType as ReferralSourceType] ?? referral.sourceType

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">خط سير المعاملة</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <PenLine className="size-4" />
            تصحيح
          </Button>
          <Button size="sm" className="gap-1.5" disabled={printing} onClick={printPdf}>
            <Printer className="size-4" />
            {printing ? "جارٍ التصدير…" : "طباعة خط السير"}
          </Button>
        </div>
      </div>

      {/* المنطقة القابلة للطباعة: ترويسة + ملخّص + خط زمني على صفحة A4 واحدة */}
      <div ref={printRef} dir="rtl" className="rounded-lg bg-card p-6 text-card-foreground">
        <header className="mb-4 flex items-center justify-between gap-4 border-b border-border pb-3">
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-foreground">MHS</span>
            <span className="text-xs text-muted-foreground">{orgName || "نظام إدارة السلامة"}</span>
          </div>
          <div className="flex flex-col items-end">
            <span dir="ltr" className="font-mono text-sm font-semibold text-foreground">
              {referral.refNo}
            </span>
            <span className="text-xs text-muted-foreground">
              {sourceLabel} <span dir="ltr">#{referral.sourceId}</span>
            </span>
          </div>
        </header>

        {/* شريط الملخّص */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat icon={Clock} label="إجمالي المدة" value={fmtDuration(summary.totalMs)} />
          <SummaryStat icon={Building2} label="أقسام المرور" value={`${summary.deptCount}`} />
          <SummaryStat icon={Undo2} label="مرات الإرجاع" value={`${summary.returnCount}`} />
          <div className="flex flex-col gap-1 rounded-md border border-border p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5" />
              المهلة
            </span>
            {summary.withinSla ? (
              <Badge variant="secondary" className="w-fit bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
                ضمن المهلة
              </Badge>
            ) : (
              <Badge variant="secondary" className="w-fit bg-amber-500/15 text-amber-700 dark:text-amber-400">
                متأخر بـ {summary.lateHours} ساعة
              </Badge>
            )}
          </div>
        </div>

        {chainDepts.length > 1 && (
          <div className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">سلسلة التحويل:</span>
            {chainDepts.map((c, i) => (
              <span key={`${c.refNo}-${i}`} className="flex items-center gap-1.5">
                <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">{c.nameAr}</span>
                {i < chainDepts.length - 1 && <span aria-hidden>←</span>}
              </span>
            ))}
          </div>
        )}

        {/* الخط الزمني الرأسي */}
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">لا توجد أحداث مسجّلة</p>
        ) : (
          <ol className="relative flex flex-col gap-5 border-e-2 border-border pe-5">
            {events.map((ev, i) => {
              const tone = toneOf(ev.action)
              const prev = i > 0 ? events[i - 1] : null
              const gapMs = prev ? new Date(ev.createdAt).getTime() - new Date(prev.createdAt).getTime() : 0
              return (
                <li key={ev.id} className="relative">
                  <span
                    className={`absolute -end-[1.4rem] top-1 size-3 rounded-full ring-4 ${dotTone[tone]}`}
                    aria-hidden
                  />
                  <div className="flex flex-col gap-1.5 rounded-md border border-border bg-background p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {actionLabels[ev.action] ?? ev.action}
                      </span>
                      <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                        {fmtDateTime(ev.createdAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {ev.actorName && <span className="font-medium text-foreground/90">{ev.actorName}</span>}
                      {ev.actorRole && <span>• {roleLabel(ev.actorRole)}</span>}
                      {ev.stageDeptName && <span>• {ev.stageDeptName}</span>}
                    </div>
                    {ev.comment && <p className="text-sm text-foreground/80">{ev.comment}</p>}
                    {prev && (
                      <span className="text-[11px] text-muted-foreground/80">{fmtElapsed(gapMs)}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <footer className="mt-5 border-t border-border pt-2 text-center text-[11px] text-muted-foreground">
          مستند مُصدَّر من نظام MHS — {fmtDateTime(new Date().toISOString())}
        </footer>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>إضافة تصحيح</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            لا يمكن حذف أو تعديل أي حدث سابق. يُسجَّل التصحيح كحدث جديد في خط السير مع سببه.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="correction-text">سبب التصحيح (إلزامي)</Label>
            <Textarea
              id="correction-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="اكتب سبب التصحيح…"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button onClick={submitCorrection} disabled={pending}>
              حفظ التصحيح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}

const roleLabels: Record<string, string> = {
  platform_admin: "مسؤول المنصّة",
  general_manager: "المدير العام",
  manager: "مدير",
  safety_inspector: "مفتش السلامة",
  supervisor: "مشرف",
  user: "مستخدم",
}

function roleLabel(role: string): string {
  return roleLabels[role] ?? role
}
