"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Cctv, MapPin, Radio, UserRound, LayoutGrid } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { CameraStreamDto } from "../connected-cameras"

// اعتبار الكاميرا "مباشرة" إذا كان آخر إطار خلال آخر 8 ثوانٍ.
const LIVE_THRESHOLD_MS = 8000
// جدار العرض يُحدَّث بوتيرة أسرع من اللوحة (كل ثانيتين) لأنه شاشة مراقبة حية.
const POLL_MS = 2000

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())

// كسر الكاش لإطارات Blob (روابط http) بحيث تُحدَّث الصورة مع كل جلب.
function frameSrc(url: string, version: string) {
  if (!url) return "/placeholder.svg"
  if (url.startsWith("http")) return `${url}?v=${encodeURIComponent(version)}`
  return url
}

// أعمدة الشبكة حسب عدد الكاميرات الحية — نملأ الشاشة بكثافة مناسبة.
function gridColsClass(count: number) {
  if (count <= 1) return "grid-cols-1"
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2"
  if (count <= 9) return "grid-cols-2 lg:grid-cols-3"
  return "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
}

export function GridView({ initial }: { initial: CameraStreamDto[] }) {
  const { data } = useSWR<{ cameras: CameraStreamDto[] }>(
    "/api/ai-monitoring/active-cameras",
    fetcher,
    {
      refreshInterval: POLL_MS,
      fallbackData: { cameras: initial },
      revalidateOnMount: true,
      revalidateOnFocus: true,
    },
  )
  const cameras = data?.cameras ?? initial

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // الكاميرات الحية أولاً ثم غير المتصلة، وكل مجموعة مرتّبة بالأحدث.
  const sorted = useMemo(() => {
    return [...cameras].sort((a, b) => {
      const la = now - new Date(a.lastSeenAt).getTime() < LIVE_THRESHOLD_MS ? 1 : 0
      const lb = now - new Date(b.lastSeenAt).getTime() < LIVE_THRESHOLD_MS ? 1 : 0
      if (la !== lb) return lb - la
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    })
  }, [cameras, now])

  const liveCount = cameras.filter(
    (c) => now - new Date(c.lastSeenAt).getTime() < LIVE_THRESHOLD_MS,
  ).length

  if (cameras.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-12 text-center">
        <Cctv className="size-10 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">لا توجد كاميرات نشطة لعرضها على الجدار.</p>
        <p className="text-xs text-muted-foreground/70">ابدأ بثاً من صفحة كاميرا الهاتف لعرضه هنا.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <LayoutGrid className="size-4 text-primary" />
          جدار العرض المباشر
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {liveCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
              <span className="size-1.5 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
              {liveCount} بث حي الآن
            </span>
          )}
          {cameras.length} كاميرا
        </span>
      </div>

      <div className={cn("grid gap-3", gridColsClass(liveCount || cameras.length))}>
        {sorted.map((cam) => {
          const isLive = now - new Date(cam.lastSeenAt).getTime() < LIVE_THRESHOLD_MS
          const title = cam.inspectorName || cam.cameraId
          return (
            <Link
              key={cam.id}
              href={`/ai-monitoring/live/${encodeURIComponent(cam.cameraId)}`}
              className={cn(
                "group relative aspect-video overflow-hidden rounded-xl border bg-black transition-all focus:outline-none focus:ring-2 focus:ring-ring/40",
                isLive ? "border-destructive/50" : "border-border opacity-70 hover:opacity-100",
              )}
              aria-label={`فتح البث المباشر — ${title}`}
            >
              {cam.lastFrameUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={frameSrc(cam.lastFrameUrl, cam.lastSeenAt) || "/placeholder.svg"}
                  alt={`آخر إطار من بث ${title}`}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-white/40">
                  <Cctv className="size-8" />
                </div>
              )}

              {/* شارة البث الحي */}
              <div
                className={cn(
                  "absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  isLive ? "bg-destructive text-white" : "bg-black/65 text-white/90",
                )}
              >
                <span
                  className={cn("size-2 rounded-full", isLive ? "animate-pulse bg-white" : "bg-white/50")}
                  aria-hidden="true"
                />
                {isLive ? "بث حي" : "غير متصل"}
              </div>

              {/* شريط سفلي: الاسم والموقع */}
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/85 to-transparent p-2.5">
                <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                  <UserRound className="size-3.5 shrink-0" />
                  <span className="truncate">{title}</span>
                </span>
                <span className="flex items-center gap-1.5 truncate text-xs text-white/70">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">{cam.cameraLocation || "موقع غير محدد"}</span>
                </span>
              </div>

              {/* أيقونة الدخول عند المرور */}
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                <span className="flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  <Radio className="size-3.5" />
                  مشاهدة مباشرة
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
