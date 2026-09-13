"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Inbox, Clock, MessageSquarePlus, History } from "lucide-react"
import {
  acknowledgeReferral,
  startReferral,
  returnReferral,
  closeReferral,
  commentOnReferral,
  getReferralWithTimeline,
} from "@/app/actions/referrals"
import {
  referralStatusLabels,
  referralStatusBadge,
  priorityLabels,
  priorityBadge,
  sourceTypeLabels,
  isOverdue,
  type ReferralStatus,
  type ReferralSourceType,
} from "@/lib/departments"

type Referral = {
  id: number
  refNo: string
  sourceType: string
  sourceId: number
  priority: string
  status: string
  notes: string
  createdByName: string
  dueAt: string | null
  createdAt: string
  closedBy: string
  closureNote: string
}

type TimelineEvent = {
  id: number
  actorName: string
  action: string
  fromStatus: string
  toStatus: string
  comment: string
  createdAt: string
}

const actionLabels: Record<string, string> = {
  created: "أُنشئت",
  acknowledged: "استُلمت",
  assigned: "أُسندت",
  in_progress: "بدأت المعالجة",
  returned: "أُعيدت",
  closed: "أُغلقت",
  comment: "تعليق",
}

function fmt(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" })
}

// صندوق وارد قسم: تبويبات حسب نوع السجل المُحال، وجدول بإجراءات دورة حياة الإحالة
// (استلام / بدء / إعادة / إغلاق / تعليق) وخط زمني لكل إحالة.
export function DepartmentInbox({ items }: { items: Referral[] }) {
  const router = useRouter()
  const routeParams = useParams<{ code: string }>()
  const deptCode = (routeParams?.code ?? "").toString().toUpperCase()
  const [tab, setTab] = useState<string>("all")

  // أنواع السجلات الحاضرة فعلياً في هذا الصندوق (تبويبات ديناميكية).
  const presentTypes = useMemo(() => {
    const set = new Set<string>()
    for (const it of items) set.add(it.sourceType)
    return Array.from(set)
  }, [items])

  const filtered = tab === "all" ? items : items.filter((it) => it.sourceType === tab)

  return (
    <Card className="p-0">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">
              الكل
              <Badge variant="secondary" className="ms-2">
                {items.length}
              </Badge>
            </TabsTrigger>
            {presentTypes.map((tp) => (
              <TabsTrigger key={tp} value={tp}>
                {sourceTypeLabels[tp as ReferralSourceType] ?? tp}
                <Badge variant="secondary" className="ms-2">
                  {items.filter((it) => it.sourceType === tp).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={tab} className="m-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <Inbox className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">لا توجد إحالات في هذا التبويب</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">رقم الإحالة</TableHead>
                    <TableHead className="text-start">المصدر</TableHead>
                    <TableHead className="text-start">الأولوية</TableHead>
                    <TableHead className="text-start">الحالة</TableHead>
                    <TableHead className="text-start">الاستحقاق</TableHead>
                    <TableHead className="text-start">أنشأها</TableHead>
                    <TableHead className="text-end">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((it) => {
                    const overdue = isOverdue(it.dueAt, it.status)
                    return (
                      <TableRow key={it.id}>
                        <TableCell dir="ltr" className="text-start font-mono text-xs">
                          {it.refNo && deptCode ? (
                            <Link
                              href={`/departments/${deptCode}/${encodeURIComponent(it.refNo)}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {it.refNo}
                            </Link>
                          ) : (
                            it.refNo || `#${it.id}`
                          )}
                        </TableCell>
                        <TableCell className="text-start">
                          <span className="text-sm">
                            {sourceTypeLabels[it.sourceType as ReferralSourceType] ?? it.sourceType}
                          </span>
                          <span dir="ltr" className="ms-1 font-mono text-xs text-muted-foreground">
                            #{it.sourceId}
                          </span>
                        </TableCell>
                        <TableCell className="text-start">
                          <Badge className={priorityBadge[it.priority] ?? ""} variant="secondary">
                            {priorityLabels[it.priority] ?? it.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-start">
                          <Badge className={referralStatusBadge[it.status as ReferralStatus] ?? ""} variant="secondary">
                            {referralStatusLabels[it.status as ReferralStatus] ?? it.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-start">
                          <span className={`text-xs ${overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                            {overdue && <Clock className="me-1 inline size-3" />}
                            {fmt(it.dueAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-start text-sm text-muted-foreground">
                          {it.createdByName || "—"}
                        </TableCell>
                        <TableCell className="text-end">
                          <ReferralActions referral={it} onDone={() => router.refresh()} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  )
}

function ReferralActions({ referral, onDone }: { referral: Referral; onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"timeline" | "return" | "close" | "comment">("timeline")
  const [events, setEvents] = useState<TimelineEvent[] | null>(null)
  const [text, setText] = useState("")
  const [error, setError] = useState("")

  const isClosed = referral.status === "closed"

  function openDialog(next: typeof mode) {
    setMode(next)
    setText("")
    setError("")
    setOpen(true)
    if (next === "timeline") {
      setEvents(null)
      getReferralWithTimeline(referral.id).then((r) => setEvents((r?.events as unknown as TimelineEvent[]) ?? []))
    }
  }

  function run(fn: () => Promise<unknown>) {
    setError("")
    startTransition(async () => {
      try {
        await fn()
        setOpen(false)
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر تنفيذ العملية")
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {referral.status === "new" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => acknowledgeReferral(referral.id))}>
          استلام
        </Button>
      )}
      {(referral.status === "new" || referral.status === "acknowledged" || referral.status === "returned") && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => startReferral(referral.id))}>
          بدء
        </Button>
      )}
      {!isClosed && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => openDialog("return")}>
          إعادة
        </Button>
      )}
      {!isClosed && (
        <Button size="sm" disabled={pending} onClick={() => openDialog("close")}>
          إغلاق
        </Button>
      )}
      <Button size="icon" variant="ghost" title="تعليق" onClick={() => openDialog("comment")}>
        <MessageSquarePlus className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" title="الخط الزمني" onClick={() => openDialog("timeline")}>
        <History className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "timeline" && "الخط الزمني للإحالة"}
              {mode === "return" && "إعادة الإحالة للمصدر"}
              {mode === "close" && "إغلاق الإحالة"}
              {mode === "comment" && "إضافة تعليق"}
            </DialogTitle>
          </DialogHeader>

          {mode === "timeline" && (
            <div className="max-h-80 overflow-y-auto">
              {events === null ? (
                <p className="p-4 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
              ) : events.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">لا توجد أحداث</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {events.map((ev) => (
                    <li key={ev.id} className="flex flex-col gap-1 border-s-2 border-border ps-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {actionLabels[ev.action] ?? ev.action}
                        </span>
                        <span className="text-xs text-muted-foreground">{fmt(ev.createdAt)}</span>
                      </div>
                      {ev.actorName && <span className="text-xs text-muted-foreground">{ev.actorName}</span>}
                      {ev.comment && <p className="text-sm text-foreground/80">{ev.comment}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {(mode === "return" || mode === "close" || mode === "comment") && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ref-text">
                {mode === "return" && "سبب الإعادة (إلزامي)"}
                {mode === "close" && "ملاحظة الإغلاق"}
                {mode === "comment" && "التعليق"}
              </Label>
              <Textarea
                id="ref-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="اكتب هنا…"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {mode !== "timeline" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              {mode === "return" && (
                <Button disabled={pending} onClick={() => run(() => returnReferral(referral.id, text))}>
                  تأكيد الإعادة
                </Button>
              )}
              {mode === "close" && (
                <Button disabled={pending} onClick={() => run(() => closeReferral(referral.id, { closureNote: text }))}>
                  تأكيد الإغلاق
                </Button>
              )}
              {mode === "comment" && (
                <Button disabled={pending} onClick={() => run(() => commentOnReferral(referral.id, text))}>
                  إضافة
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
