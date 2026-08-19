"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Cctv, LayoutGrid } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { HAS_TURN } from "@/lib/webrtc-client"
import type { CameraStreamDto } from "../connected-cameras"
import { GridTile } from "./grid-tile"
import { useI18n } from "@/lib/i18n/client"

// اعتبار الكاميرا "مباشرة" إذا كان آخر إطار خلال آخر 8 ثوانٍ.
const LIVE_THRESHOLD_MS = 8000
// جدار العرض يُحدَّث بوتيرة أسرع من اللوحة (كل ثانيتين) لأنه شاشة مراقبة حية.
const POLL_MS = 2000
// حدّ أقصى لعدد اتصالات WebRTC الحية المتزامنة على الجدار حمايةً لجهاز المدير.
// البطاقات الحية الزائدة عن الحد تبقى على اللقطات.
const MAX_LIVE_PEERS = 12

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())

// أعمدة الشبكة حسب عدد الكاميرات الحية — نملأ الشاشة بكثافة مناسبة.
function gridColsClass(count: number) {
  if (count <= 1) return "grid-cols-1"
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2"
  if (count <= 9) return "grid-cols-2 lg:grid-cols-3"
  return "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
}

export function GridView({ initial }: { initial: CameraStreamDto[] }) {
  const { t, formatNumber } = useI18n()
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

  // نبدأ بـ 0 (قيمة ثابتة على الخادم والعميل) لتفادي عدم تطابق الترطيب الناتج عن
  // اختلاف Date.now() بين وقت SSR ووقت الترطيب. نضبط الوقت الحقيقي فور التركيب.
  const [now, setNow] = useState(0)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // حالة "حي" مع حارس now===0: قبل ضبط الوقت الحقيقي (SSR وأول رسم عميل) نعتبر
  // الجميع غير متصل حتى يتطابق الترطيب ولا يومض الجدار.
  const isLiveAt = (lastSeenAt: string) => now !== 0 && now - new Date(lastSeenAt).getTime() < LIVE_THRESHOLD_MS

  // الكاميرات الحية أولاً ثم غير المتصلة، وكل مجموعة مرتّبة بالأحدث.
  const sorted = useMemo(() => {
    return [...cameras].sort((a, b) => {
      const la = isLiveAt(a.lastSeenAt) ? 1 : 0
      const lb = isLiveAt(b.lastSeenAt) ? 1 : 0
      if (la !== lb) return lb - la
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameras, now])

  const liveCount = cameras.filter((c) => isLiveAt(c.lastSeenAt)).length

  if (cameras.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-12 text-center">
        <Cctv className="size-10 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{t("aiMonitoring.cam.gridEmptyTitle")}</p>
        <p className="text-xs text-muted-foreground/70">{t("aiMonitoring.cam.gridEmptyHint")}</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <LayoutGrid className="size-4 text-primary" />
          {t("aiMonitoring.cam.gridWallTitle")}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {/* شارة تشخيص عبور الشبكة: TURN مفعّل (اجتياز موثوق) أو STUN فقط. */}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
              HAS_TURN ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600",
            )}
            title={HAS_TURN ? t("aiMonitoring.cam.gridTurnTip") : t("aiMonitoring.cam.gridStunTip")}
          >
            {HAS_TURN ? t("aiMonitoring.cam.gridBadgeTurn") : t("aiMonitoring.cam.gridBadgeStun")}
          </span>
          {liveCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
              <span className="size-1.5 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
              {t("aiMonitoring.cam.liveNowCount").replace("{n}", formatNumber(liveCount))}
            </span>
          )}
          {t("aiMonitoring.cam.camerasCount").replace("{n}", formatNumber(cameras.length))}
        </span>
      </div>

      <div className={cn("grid gap-3", gridColsClass(liveCount || cameras.length))}>
        {sorted.map((cam, index) => {
          const isLive = isLiveAt(cam.lastSeenAt)
          // نفتح WebRTC للبطاقات الحية فقط وحتى الحدّ الأقصى (المرتّبة أولاً حية).
          const enableWebrtc = isLive && index < MAX_LIVE_PEERS
          return <GridTile key={cam.id} cam={cam} isLive={isLive} enableWebrtc={enableWebrtc} />
        })}
      </div>
    </div>
  )
}
