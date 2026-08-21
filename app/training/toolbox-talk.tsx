"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { deleteToolboxSession, importToolboxSessions, saveToolboxSession } from "@/app/actions/hse"
import {
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Printer,
  Save,
  Users,
  PenLine,
  X,
  History,
  Truck,
  PackageOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import type { EmployeeRecord } from "./employee-registry"
import { useI18n } from "@/lib/i18n/client"
import type { TFunction } from "@/lib/i18n/translate"

// ===== Worker groups & weekly schedule =====
// JS getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
type Group = {
  id: "forklift" | "loading"
  icon: typeof Truck
  days: number[]
}

const GROUPS: Group[] = [
  { id: "forklift", icon: Truck, days: [0, 3, 4] },
  { id: "loading", icon: PackageOpen, days: [1, 2] },
]

// Translated display helpers for a group (label + weekly days).
function groupLabel(t: TFunction, id: Group["id"]) {
  return id === "forklift" ? t("trainingMod.tbGroupForklift") : t("trainingMod.tbGroupLoading")
}
function groupDaysLabel(t: TFunction, id: Group["id"]) {
  return id === "forklift" ? t("trainingMod.tbDaysForklift") : t("trainingMod.tbDaysLoading")
}
function dayName(t: TFunction, dow: number) {
  const keys = ["daySun", "dayMon", "dayTue", "dayWed", "dayThu", "dayFri", "daySat"] as const
  return t(`trainingMod.${keys[dow]}`)
}

const DEFAULT_CONDUCTOR = "سليمان العوفي"
const DEFAULT_LOCATION = "السوق المركزي"

const STORAGE_KEY = "mhs-toolbox-talks"

type AttendeeRow = {
  id: string
  employeeId: string
  name: string
  jobTitle: string
  company: string
  cardCode: string
  signature: string
}

type ToolboxSession = {
  id: string
  databaseId?: number
  groupId: Group["id"]
  topic: string
  conductor: string
  location: string
  date: string
  photo: string
  attendees: AttendeeRow[]
  createdAt: string
}

function newRow(): AttendeeRow {
  return { id: crypto.randomUUID(), employeeId: "", name: "", jobTitle: "", company: "MHS", cardCode: "", signature: "" }
}

function normalizeAttendee(row: AttendeeRow): AttendeeRow {
  return { ...row, employeeId: row.employeeId ?? "", cardCode: row.cardCode ?? "" }
}

// ===== localStorage helpers =====
function loadSessions(): ToolboxSession[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.map((session) => ({ ...session, attendees: Array.isArray(session.attendees) ? session.attendees.map(normalizeAttendee) : [] }))
      : []
  } catch {
    return []
  }
}

function saveSessions(sessions: ToolboxSession[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

// Generates the next auto ID in format TB-YYYY-### based on existing sessions.
function nextSessionId(sessions: ToolboxSession[]): string {
  const year = new Date().getFullYear()
  const prefix = `TB-${year}-`
  const maxSeq = sessions
    .filter((s) => s.id.startsWith(prefix))
    .reduce((max, s) => {
      const seq = Number.parseInt(s.id.slice(prefix.length), 10)
      return Number.isFinite(seq) && seq > max ? seq : max
    }, 0)
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`
}

// ===== Signature pad (mouse + touch) =====
function SignaturePad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    }
  }
  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    drawingRef.current = true
    const ctx = canvasRef.current!.getContext("2d")!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!drawingRef.current) return
    const ctx = canvasRef.current!.getContext("2d")!
    ctx.strokeStyle = "#1a1a2e"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }
  function end() {
    if (!drawingRef.current) return
    drawingRef.current = false
    onChange(canvasRef.current!.toDataURL())
  }
  function clear() {
    const canvas = canvasRef.current!
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height)
    onChange("")
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative overflow-hidden rounded-md border-2 border-dashed border-border bg-white">
        <canvas
          ref={canvasRef}
          width={200}
          height={64}
          className="touch-none cursor-crosshair"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={end}
        />
        {!value && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <PenLine className="size-3" /> {t("trainingMod.signHere")}
            </span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
      >
        <X className="size-3" /> {t("trainingMod.clearSignature")}
      </button>
    </div>
  )
}

type StoredToolboxSession = {
  id: number
  documentNo: string
  date: string
  location: string
  topic: string
  speaker: string
  summary: string
  photos: string[]
  createdAt: Date
  attendees: AttendeeRow[]
}

export function ToolboxTalkTab({ employees, initialSessions }: { employees: EmployeeRecord[]; initialSessions: StoredToolboxSession[] }) {
  const { t, locale, dir } = useI18n()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const today = new Date()
  const todayDow = today.getDay()
  const todayStr = today.toISOString().slice(0, 10)

  const [groupId, setGroupId] = useState<Group["id"]>("forklift")
  const [topic, setTopic] = useState("")
  const [conductor, setConductor] = useState(DEFAULT_CONDUCTOR)
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [date, setDate] = useState(todayStr)
  const [photo, setPhoto] = useState("")
  const [rows, setRows] = useState<AttendeeRow[]>([newRow()])
  const [sessions, setSessions] = useState<ToolboxSession[]>(() => initialSessions.map((session) => ({
    id: session.documentNo,
    databaseId: session.id,
    groupId: session.summary === "loading" ? "loading" : "forklift",
    topic: session.topic,
    conductor: session.speaker,
    location: session.location,
    date: session.date,
    photo: session.photos[0] ?? "",
    attendees: session.attendees.map(normalizeAttendee),
    createdAt: new Date(session.createdAt).toISOString(),
  })))

  useEffect(() => {
    if (window.localStorage.getItem(`${STORAGE_KEY}:imported`) === "true") return
    const legacy = loadSessions()
    if (legacy.length === 0) {
      window.localStorage.setItem(`${STORAGE_KEY}:imported`, "true")
      return
    }
    startTransition(async () => {
      await importToolboxSessions(legacy.map((session) => ({
        id: session.id,
        sourceKey: `local-${session.id}`,
        documentNo: session.id,
        date: session.date,
        location: session.location,
        topic: session.topic,
        speaker: session.conductor,
        summary: session.groupId,
        photos: session.photo ? [session.photo] : [],
        attendees: session.attendees,
      })))
      window.localStorage.setItem(`${STORAGE_KEY}:imported`, "true")
      router.refresh()
    })
  }, [router])

  const group = GROUPS.find((g) => g.id === groupId)!
  const scheduledToday = group.days.includes(todayDow)

  const activeEmployees = employees.filter((employee) => employee.active)
  const designations = Array.from(new Set(activeEmployees.map((employee) => employee.designation))).sort((a, b) => a.localeCompare(b, locale))

  function updateRow(id: string, key: keyof AttendeeRow, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)))
  }

  function selectEmployee(rowId: string, employeeId: string) {
    const employee = activeEmployees.find((item) => item.employeeId === employeeId)
    if (!employee) return
    setRows((prev) => prev.map((row) => row.id === rowId ? {
      ...row,
      employeeId: employee.employeeId,
      name: employee.name,
      jobTitle: employee.designation,
      company: "MHS",
      cardCode: employee.cardCode ?? "",
    } : row))
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : "")
    reader.readAsDataURL(file)
  }

  function resetForm() {
    setTopic("")
    setConductor(DEFAULT_CONDUCTOR)
    setLocation(DEFAULT_LOCATION)
    setDate(todayStr)
    setPhoto("")
    setRows([newRow()])
  }

  function handleSave() {
    if (!topic.trim()) {
      toast({ title: t("trainingMod.tbToastTopicRequired"), variant: "destructive" })
      return
    }
    const filled = rows.filter((r) => r.name.trim() !== "")
    if (filled.length === 0 || filled.some((row) => !row.employeeId.trim())) {
      toast({ title: t("trainingMod.tbToastAttendeeRequired"), variant: "destructive" })
      return
    }
    startTransition(async () => {
      const result = await saveToolboxSession({
        date,
        location: location.trim() || DEFAULT_LOCATION,
        topic: topic.trim(),
        speaker: conductor.trim() || DEFAULT_CONDUCTOR,
        summary: groupId,
        photos: photo ? [photo] : [],
        attendees: filled,
      })
      setSessions((current) => [{
        id: result.documentNo,
        databaseId: result.id,
        groupId,
        topic: topic.trim(),
        conductor: conductor.trim() || DEFAULT_CONDUCTOR,
        location: location.trim() || DEFAULT_LOCATION,
        date,
        photo,
        attendees: filled,
        createdAt: new Date().toISOString(),
      }, ...current])
      toast({ title: t("trainingMod.tbToastSessionSaved"), description: `${t("trainingMod.tbRecordNo")}: ${result.documentNo}` })
      resetForm()
      router.refresh()
    })
  }

  // Builds an Arabic RTL printable HTML document and triggers the print dialog.
  function printSession(session: ToolboxSession) {
    const rowsHtml = session.attendees
      .map((a, i) => {
        const sig = a.signature.startsWith("data:image")
          ? `<img src="${a.signature}" style="max-height:40px;max-width:130px;" />`
          : ""
        return `<tr>
          <td style="border:1px solid #000;padding:6px;text-align:center;">${i + 1}</td>
          <td style="border:1px solid #000;padding:6px;">${escapeHtml(a.name)}</td>
          <td style="border:1px solid #000;padding:6px;">${escapeHtml(a.jobTitle)}</td>
          <td style="border:1px solid #000;padding:6px;">${escapeHtml(a.company)}</td>
          <td style="border:1px solid #000;padding:6px;text-align:center;">${sig}</td>
        </tr>`
      })
      .join("")

    const photoHtml = session.photo
      ? `<div style="margin-top:16px;"><h3 style="color:#0f766e;margin:0 0 6px;font-size:13pt;">${t("trainingMod.tbPrintPhotoTitle")}</h3><img src="${session.photo}" style="max-width:320px;max-height:240px;border:1px solid #cbd5e1;border-radius:4px;" /></div>`
      : ""

    const html = `<!DOCTYPE html>
    <html lang="${locale}" dir="${dir}">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(session.id)} — ${t("trainingMod.tbPrintDocTitle")}</title>
      <style>
        * { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
        body { margin: 24px; color: #111; }
        .header { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #0f766e; padding-bottom:10px; margin-bottom:16px; }
        .brand { font-size:22pt; font-weight:bold; color:#0f766e; }
        .doc-no { font-size:11pt; color:#334155; }
        h1 { font-size:16pt; margin:0 0 12px; }
        table.meta { width:100%; border-collapse:collapse; margin-bottom:16px; }
        table.meta td { border:1px solid #cbd5e1; padding:8px; font-size:12pt; }
        table.meta td.label { background:#f1f5f9; font-weight:bold; width:160px; }
        table.att { width:100%; border-collapse:collapse; }
        table.att th { border:1px solid #000; background:#e2e8f0; padding:6px; font-size:11pt; }
        .footer { margin-top:24px; border-top:1px solid #cbd5e1; padding-top:8px; text-align:center; font-size:10pt; color:#64748b; }
        @media print { body { margin: 12mm; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">MHS</div>
        <div class="doc-no">
          <div>${t("trainingMod.tbPrintHeader")}</div>
          <div>${t("trainingMod.tbRecordNo")}: <strong>${escapeHtml(session.id)}</strong></div>
        </div>
      </div>
      <h1>${escapeHtml(session.topic)}</h1>
      <table class="meta">
        <tr><td class="label">${t("trainingMod.tbPrintGroup")}</td><td>${escapeHtml(groupLabel(t, session.groupId))}</td><td class="label">${t("trainingMod.tbPrintDate")}</td><td dir="ltr">${escapeHtml(session.date)}</td></tr>
        <tr><td class="label">${t("trainingMod.tbPrintConductor")}</td><td>${escapeHtml(session.conductor)}</td><td class="label">${t("trainingMod.tbPrintLocation")}</td><td>${escapeHtml(session.location)}</td></tr>
      </table>
      <h3 style="color:#0f766e;margin:0 0 6px;font-size:13pt;">${t("trainingMod.tbPrintAttendance")} (${session.attendees.length})</h3>
      <table class="att">
        <thead>
          <tr>
            <th>${t("trainingMod.tbPrintColNo")}</th><th>${t("trainingMod.tbPrintColName")}</th><th>${t("trainingMod.tbPrintColJobTitle")}</th><th>${t("trainingMod.tbPrintColCompany")}</th><th>${t("trainingMod.tbPrintColSignature")}</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${photoHtml}
      <div class="footer">${t("trainingMod.tbPrintFooter")}</div>
      <script>window.onload = function () { window.print(); }</script>
    </body>
    </html>`

    const win = window.open("", "_blank")
    if (!win) {
      toast({ title: t("trainingMod.tbToastPrintFailed"), description: t("trainingMod.tbToastPrintFailedDesc"), variant: "destructive" })
      return
    }
    win.document.write(html)
    win.document.close()
  }

  function deleteSession(session: ToolboxSession) {
    if (!session.databaseId) return
    startTransition(async () => {
      await deleteToolboxSession(session.databaseId!)
      setSessions((current) => current.filter((item) => item.databaseId !== session.databaseId))
      toast({ title: t("trainingMod.tbToastRecordDeleted") })
      router.refresh()
    })
  }

  return (
    <Tabs defaultValue="new" dir={dir} className="gap-4">
      <TabsList>
        <TabsTrigger value="new">{t("trainingMod.tbTabNew")}</TabsTrigger>
        <TabsTrigger value="history">{t("trainingMod.tbTabHistory")} ({sessions.length})</TabsTrigger>
      </TabsList>

      {/* ===== New session ===== */}
      <TabsContent value="new" className="flex flex-col gap-4">
        {/* Group selector */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {GROUPS.map((g) => {
            const Icon = g.icon
            const active = g.id === groupId
            const scheduled = g.days.includes(todayDow)
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupId(g.id)}
                className={`flex items-start gap-3 rounded-lg border p-4 text-start transition-colors ${
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <span className={`rounded-md p-2 ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold text-foreground">{groupLabel(t, g.id)}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="size-3" /> {groupDaysLabel(t, g.id)}
                  </span>
                  {scheduled && (
                    <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                      <CheckCircle2 className="size-3" /> {t("trainingMod.tbScheduledTodayBadge")}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {/* Today schedule alert */}
        {scheduledToday ? (
          <Alert className="border-primary/40 bg-primary/5">
            <CheckCircle2 className="size-4 text-primary" />
            <AlertTitle>{t("trainingMod.tbScheduledAlertTitle")}</AlertTitle>
            <AlertDescription>
              {t("trainingMod.tbScheduledAlertDesc")
                .replace("{day}", dayName(t, todayDow))
                .replace("{group}", groupLabel(t, group.id))}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>{t("trainingMod.tbNotScheduledTitle")}</AlertTitle>
            <AlertDescription>
              {t("trainingMod.tbNotScheduledDesc")
                .replace("{day}", dayName(t, todayDow))
                .replace("{group}", groupLabel(t, group.id))
                .replace("{days}", groupDaysLabel(t, group.id))}
            </AlertDescription>
          </Alert>
        )}

        {/* Session form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("trainingMod.tbSessionData")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t("trainingMod.tbTopicLabel")} <span className="text-destructive">*</span></Label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t("trainingMod.tbTopicPlaceholder")}
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("trainingMod.tbConductor")}</Label>
              <Input value={conductor} onChange={(e) => setConductor(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("trainingMod.tbLocation")}</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("trainingMod.tbDate")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("trainingMod.tbSessionPhoto")}</Label>
              <Input type="file" accept="image/*" onChange={handlePhoto} />
            </div>
            {photo && (
              <div className="sm:col-span-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo || "/placeholder.svg"} alt={t("trainingMod.tbSessionPhoto")} className="h-32 w-auto rounded-md border border-border object-cover" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance table */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-muted-foreground" /> {t("trainingMod.attendanceLog")}
            </CardTitle>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setRows((r) => [...r, newRow()])}>
              <Plus className="size-4" /> {t("trainingMod.tbAddRow")}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm" dir={dir}>
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-2 py-2 text-center font-semibold">#</th>
                    <th className="border border-border px-3 py-2 text-start font-semibold">{t("trainingMod.tbColDesignation")}</th>
                    <th className="border border-border px-3 py-2 text-start font-semibold">{t("trainingMod.tbColEmployee")}</th>
                    <th className="border border-border px-3 py-2 text-start font-semibold">{t("trainingMod.tbColEmployeeId")}</th>
                    <th className="border border-border px-3 py-2 text-start font-semibold">{t("trainingMod.tbColCard")}</th>
                    <th className="border border-border px-3 py-2 text-start font-semibold">{t("trainingMod.tbColCompany")}</th>
                    <th className="border border-border px-3 py-2 text-center font-semibold">{t("trainingMod.tbColSignature")}</th>
                    <th className="border border-border px-2 py-2 text-center font-semibold">{t("trainingMod.tbColDelete")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} className="even:bg-muted/40">
                      <td className="border border-border px-2 py-2 text-center text-muted-foreground">{i + 1}</td>
                      <td className="border border-border p-1">
                        <select value={r.jobTitle} onChange={(e) => updateRow(r.id, "jobTitle", e.target.value)} className="h-8 w-40 rounded-md border-0 bg-transparent px-2 text-sm outline-none">
                          <option value="">{t("trainingMod.tbSelectDesignation")}</option>
                          {designations.map((designation) => <option key={designation} value={designation}>{designation}</option>)}
                        </select>
                      </td>
                      <td className="border border-border p-1">
                        <select value={r.employeeId} onChange={(e) => selectEmployee(r.id, e.target.value)} className="h-8 w-48 rounded-md border-0 bg-transparent px-2 text-sm outline-none">
                          <option value="">{t("trainingMod.tbSelectEmployee")}</option>
                          {activeEmployees.filter((employee) => !r.jobTitle || employee.designation === r.jobTitle).map((employee) => <option key={employee.id} value={employee.employeeId}>{employee.name}</option>)}
                        </select>
                        <Input value={r.name} onChange={(e) => updateRow(r.id, "name", e.target.value)} placeholder={t("trainingMod.tbManualName")} className="mt-1 h-8 border-0 shadow-none focus-visible:ring-0" />
                      </td>
                      <td className="border border-border p-1"><Input value={r.employeeId} onChange={(e) => updateRow(r.id, "employeeId", e.target.value)} placeholder={t("trainingMod.tbColEmployeeId")} className="h-8 min-w-28 border-0 font-mono shadow-none focus-visible:ring-0" dir="ltr" /></td>
                      <td className="border border-border p-1"><Input value={r.cardCode} onChange={(e) => updateRow(r.id, "cardCode", e.target.value)} placeholder={t("trainingMod.tbCardPh")} className="h-8 min-w-28 border-0 shadow-none focus-visible:ring-0" dir="ltr" /></td>
                      <td className="border border-border p-1">
                        <Input value={r.company} onChange={(e) => updateRow(r.id, "company", e.target.value)} placeholder="MHS" className="h-8 border-0 shadow-none focus-visible:ring-0" />
                      </td>
                      <td className="border border-border p-1 text-center">
                        <SignaturePad value={r.signature} onChange={(v) => updateRow(r.id, "signature", v)} />
                      </td>
                      <td className="border border-border px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setRows((arr) => (arr.length > 1 ? arr.filter((x) => x.id !== r.id) : arr))}
                          disabled={rows.length === 1}
                          className="text-destructive hover:opacity-80 disabled:opacity-30"
                          aria-label={t("trainingMod.tbDeleteRow")}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={resetForm} className="gap-1">
            {t("trainingMod.tbReset")}
          </Button>
          <Button onClick={handleSave} disabled={pending} className="gap-2">
              <Save className="size-4" /> {pending ? t("trainingMod.tbSaving") : t("trainingMod.tbSaveSession")}
          </Button>
        </div>
      </TabsContent>

      {/* ===== History ===== */}
      <TabsContent value="history" className="flex flex-col gap-3">
        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <History className="mx-auto mb-2 size-6" />
            {t("trainingMod.tbNoSessions")}
          </div>
        ) : (
          sessions.map((s) => {
            return (
              <Card key={s.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary" dir="ltr">
                        {s.id}
                      </span>
                      <span className="font-semibold text-foreground">{s.topic}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="size-3" /> {groupLabel(t, s.groupId)}</span>
                      <span className="flex items-center gap-1"><CalendarDays className="size-3" /> <span dir="ltr">{s.date}</span></span>
                      <span>{t("trainingMod.tbAttendance")}: {s.attendees.length}</span>
                      <span>{t("trainingMod.tbConductorShort")}: {s.conductor}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => printSession(s)}>
                      <Printer className="size-4" /> {t("trainingMod.tbPrintPdf")}
                    </Button>
                    <button
                      type="button"
                      onClick={() => deleteSession(s)}
                      className="text-destructive hover:opacity-80"
                      aria-label={t("trainingMod.tbDeleteRecord")}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </TabsContent>
    </Tabs>
  )
}

// Escapes user text before embedding it into the printable HTML string.
function escapeHtml(v: string | number | null | undefined) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}
