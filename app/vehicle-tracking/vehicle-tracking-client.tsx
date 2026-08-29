"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  Truck,
  LogIn,
  LogOut,
  Radar,
  Search,
  ShieldAlert,
  MapPin,
  Clock,
  ChevronDown,
  CircleCheck,
  Ban,
  DoorOpen,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { KpiCard } from "@/components/kpi-card"
import { cn } from "@/lib/utils"
import { equipmentTypeLabels } from "@/lib/labels"
import {
  recordVehicleEntry,
  recordVehicleSighting,
  attemptVehicleExit,
  searchVehicle,
} from "@/app/actions/vehicle-tracking"
import {
  GATE_COUNT,
  type GateActionResult,
  type VehicleDetailDto,
  type VehicleStatus,
  type TrackingOverview,
  type PresentVehicleDto,
} from "@/lib/vehicle-tracking-shared"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const STATUS_META: Record<VehicleStatus, { label: string; cls: string; icon: typeof Truck }> = {
  inside: { label: "داخل السوق", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30", icon: DoorOpen },
  outside: { label: "خارج السوق", cls: "bg-muted text-muted-foreground border-border", icon: CircleCheck },
  blocked: { label: "محجوبة عن الخروج", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: Ban },
}

function fmt(iso: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d)
}

function typeLabel(v: string) {
  return equipmentTypeLabels[v] || v || "مركبة"
}

export function VehicleTrackingClient({
  initialOverview,
  initialInside,
}: {
  initialOverview: TrackingOverview
  initialInside: PresentVehicleDto[]
}) {
  const { data } = useSWR<{ overview: TrackingOverview; inside: PresentVehicleDto[] }>(
    "/api/vehicle-tracking/state",
    fetcher,
    { refreshInterval: 10000, fallbackData: { overview: initialOverview, inside: initialInside } },
  )
  const overview = data?.overview ?? initialOverview
  const inside = data?.inside ?? initialInside

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="إجمالي المركبات" value={overview.total} icon={Truck} tone="blue" />
        <KpiCard label="داخل السوق الآن" value={overview.inside} icon={DoorOpen} tone="primary" />
        <KpiCard label="محجوبة عن الخروج" value={overview.blocked} icon={Ban} tone="destructive" />
        <KpiCard label="خارج السوق" value={overview.outside} icon={CircleCheck} tone="accent" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GateControl />
        <VehicleSearch />
      </div>

      <InsideList inside={inside} />
    </div>
  )
}

/* ---------------- لوحة تحكم البوابات ---------------- */
function GateControl() {
  const [plate, setPlate] = useState("")
  const [gate, setGate] = useState(1)
  const [pending, start] = useTransition()
  const [result, setResult] = useState<GateActionResult | null>(null)

  function run(fn: () => Promise<GateActionResult>) {
    start(async () => {
      const res = await fn()
      setResult(res)
      if (res.ok) toast.success(res.message)
      else if (res.action === "blocked") toast.error(res.message)
      else toast.error(res.message)
    })
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Radar className="size-5" />
        </div>
        <div>
          <h2 className="font-bold text-foreground">محاكاة البوابات (ANPR)</h2>
          <p className="text-xs text-muted-foreground">تسجيل دخول/مشاهدة ومحاولة خروج المركبات عبر البوابات الـ {GATE_COUNT}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">رقم اللوحة (حروف + أرقام)</label>
        <Input
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="مثال: 3072 ي ر"
          dir="ltr"
          className="text-center font-mono"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">البوابة</label>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: GATE_COUNT }, (_, i) => i + 1).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGate(g)}
              className={cn(
                "flex size-10 items-center justify-center rounded-lg border text-sm font-bold transition-colors",
                gate === g
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
              aria-pressed={gate === g}
              aria-label={`بوابة ${g}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button disabled={pending || !plate.trim()} onClick={() => run(() => recordVehicleEntry(plate, gate))}>
          <LogIn data-icon="inline-start" />
          دخول
        </Button>
        <Button
          variant="secondary"
          disabled={pending || !plate.trim()}
          onClick={() => run(() => recordVehicleSighting(plate, `بوابة-${gate}`, `منطقة البوابة ${gate}`))}
        >
          <Radar data-icon="inline-start" />
          مشاهدة
        </Button>
        <Button
          variant="outline"
          disabled={pending || !plate.trim()}
          onClick={() => run(() => attemptVehicleExit(plate, gate))}
        >
          <LogOut data-icon="inline-start" />
          خروج
        </Button>
      </div>

      {result && (
        <div
          className={cn(
            "flex flex-col gap-2 rounded-lg border p-3 text-sm",
            result.ok
              ? "border-primary/30 bg-primary/5 text-foreground"
              : "border-destructive/30 bg-destructive/5 text-foreground",
          )}
          role="status"
        >
          <div className="flex items-center gap-2 font-medium">
            {result.action === "blocked" ? (
              <ShieldAlert className="size-4 text-destructive" />
            ) : result.ok ? (
              <CircleCheck className="size-4 text-primary" />
            ) : (
              <Ban className="size-4 text-destructive" />
            )}
            <span>{result.message}</span>
          </div>
          {result.blockingViolations && result.blockingViolations.length > 0 && (
            <ul className="flex flex-col gap-1 border-t border-destructive/20 pt-2">
              {result.blockingViolations.map((v) => (
                <li key={`${v.id}-${v.at}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-destructive">{v.type}</span>
                  <span className="text-muted-foreground" dir="ltr">
                    {fmt(v.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}

/* ---------------- البحث عن مركبة ---------------- */
function VehicleSearch() {
  const [plate, setPlate] = useState("")
  const [pending, start] = useTransition()
  const [vehicle, setVehicle] = useState<VehicleDetailDto | null>(null)
  const [searched, setSearched] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!plate.trim()) return
    start(async () => {
      const v = await searchVehicle(plate)
      setVehicle(v)
      setSearched(true)
    })
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Search className="size-5" />
        </div>
        <div>
          <h2 className="font-bold text-foreground">البحث عن مركبة</h2>
          <p className="text-xs text-muted-foreground">استعرض السجل الكامل ودخولات المركبة وخط سيرها</p>
        </div>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="ابحث برقم اللوحة"
          dir="ltr"
          className="text-center font-mono"
        />
        <Button type="submit" disabled={pending || !plate.trim()}>
          <Search data-icon="inline-start" />
          بحث
        </Button>
      </form>

      {searched && !vehicle && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          لا توجد مركبة مسجّلة بهذا الرقم.
        </p>
      )}

      {vehicle && <VehicleDetail vehicle={vehicle} />}
    </Card>
  )
}

function VehicleDetail({ vehicle }: { vehicle: VehicleDetailDto }) {
  const meta = STATUS_META[vehicle.currentStatus]
  const StatusIcon = meta.icon
  return (
    <div className="flex flex-col gap-4">
      <div className={cn("flex items-center justify-between gap-3 rounded-lg border p-3", meta.cls)}>
        <div className="flex flex-col">
          <span className="font-mono text-lg font-bold" dir="ltr">
            {vehicle.plateNumber}
          </span>
          <span className="text-xs opacity-80">{typeLabel(vehicle.vehicleType)}</span>
        </div>
        <div className="flex items-center gap-1.5 font-bold">
          <StatusIcon className="size-4" />
          {meta.label}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">سجل الدخولات ({vehicle.entries.length})</h3>
        {vehicle.entries.length === 0 && (
          <p className="text-sm text-muted-foreground">لا توجد دخولات مسجّلة لهذه المركبة.</p>
        )}
        {vehicle.entries.map((e) => (
          <EntryRow key={e.id} entry={e} />
        ))}
      </div>
    </div>
  )
}

function EntryRow({ entry }: { entry: VehicleDetailDto["entries"][number] }) {
  const [open, setOpen] = useState(false)
  const isOpen = entry.status === "open"
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 bg-muted/30 px-3 py-2.5 text-start hover:bg-muted/60"
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground" dir="ltr">
              {fmt(entry.entryTime)}
            </span>
            <span className="text-xs text-muted-foreground">
              بوابة الدخول {entry.entryGateId || "—"}
              {entry.exitTime ? ` • خروج من البوابة ${entry.exitGateId ?? "—"}` : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {entry.violations.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <ShieldAlert className="size-3" />
              {entry.violations.length}
            </Badge>
          )}
          <Badge variant={isOpen ? "default" : "secondary"}>{isOpen ? "مفتوح" : "مُغلق"}</Badge>
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-border p-3">
          {entry.violations.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-destructive">المخالفات المرتبطة</span>
              {entry.violations.map((v) => (
                <div
                  key={`${v.source}-${v.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs"
                >
                  <span className="font-medium text-foreground">{v.type}</span>
                  <span className="text-muted-foreground" dir="ltr">
                    {fmt(v.at)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-foreground">خط السير داخل السوق ({entry.sightings.length})</span>
            {entry.sightings.length === 0 && (
              <span className="text-xs text-muted-foreground">لا توجد مشاهدات مسجّلة لهذه الزيارة.</span>
            )}
            {entry.sightings.length > 0 && (
              <ol className="relative flex flex-col gap-3 ps-4">
                <span className="absolute inset-y-1 start-[5px] w-px bg-border" aria-hidden />
                {entry.sightings.map((s) => (
                  <li key={s.id} className="relative flex items-start gap-2">
                    <span className="absolute -start-4 top-1 flex size-2.5 items-center justify-center rounded-full bg-primary ring-2 ring-background" aria-hidden />
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-sm text-foreground">
                        <MapPin className="size-3.5 text-muted-foreground" />
                        {s.location || s.cameraId || "موقع غير محدّد"}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                        <Clock className="size-3" />
                        {fmt(s.at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------- المركبات داخل السوق الآن ---------------- */
function InsideList({ inside }: { inside: PresentVehicleDto[] }) {
  const [pending, start] = useTransition()

  function quickExit(plate: string, gate: number) {
    start(async () => {
      const res = await attemptVehicleExit(plate, gate || 1)
      if (res.ok) toast.success(res.message)
      else toast.error(res.message)
    })
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <DoorOpen className="size-5" />
        </div>
        <h2 className="font-bold text-foreground">المركبات داخل السوق الآن ({inside.length})</h2>
      </div>

      {inside.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          لا توجد مركبات ��اخل السوق حالياً.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {inside.map((v) => {
            const meta = STATUS_META[v.status]
            return (
              <div key={v.id} className={cn("flex flex-col gap-2 rounded-lg border p-3", meta.cls)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold" dir="ltr">
                    {v.plateNumber}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium">
                    <meta.icon className="size-3.5" />
                    {meta.label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs opacity-80">
                  <span>{typeLabel(v.vehicleType)}</span>
                  <span dir="ltr">{fmt(v.entryTime)}</span>
                </div>
                <Button
                  size="sm"
                  variant={v.status === "blocked" ? "destructive" : "outline"}
                  disabled={pending}
                  onClick={() => quickExit(v.plateNumber, v.entryGateId)}
                >
                  <LogOut data-icon="inline-start" />
                  محاولة خروج
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
