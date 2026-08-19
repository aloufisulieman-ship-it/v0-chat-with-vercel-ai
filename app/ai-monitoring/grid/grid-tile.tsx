"use client"

import Link from "next/link"
import { Cctv, MapPin, Radio, UserRound, Wifi, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWebrtcViewer } from "../live/[cameraId]/use-webrtc-viewer"
import type { CameraStreamDto } from "../connected-cameras"
import { useI18n } from "@/lib/i18n/client"

// كسر كاش إطار Blob بحيث تُحدَّث الصورة مع كل جلب.
function frameSrc(url: string, version: string) {
  if (!url) return "/placeholder.svg"
  if (url.startsWith("http")) return `${url}?v=${encodeURIComponent(version)}`
  return url
}

// تصنيف جودة الاتصال إلى ثلاث درجات (نفس منطق صفحة الكاميرا الواحدة) لتناسق العرض.
function qualityTier(kbps: number, rttMs: number): "good" | "medium" | "weak" {
  if (kbps >= 350 && (rttMs === 0 || rttMs < 200)) return "good"
  if (kbps >= 120) return "medium"
  return "weak"
}

const TIER_CLASS: Record<"good" | "medium" | "weak", string> = {
  good: "bg-emerald-500/90 text-white",
  medium: "bg-amber-500/90 text-white",
  weak: "bg-destructive/90 text-white",
}

// بطاقة كاميرا واحدة على الجدار: تفتح اتصال WebRTC حي مستقلاً وتعرض الفيديو
// المباشر مع مؤشر جودة (RTT/kbps/fps). عند تعذّر البث الحي تسقط تلقائياً إلى آخر
// لقطة Blob كصورة مصغّرة.
export function GridTile({
  cam,
  isLive,
  enableWebrtc,
}: {
  cam: CameraStreamDto
  isLive: boolean
  // نفتح WebRTC فقط للبطاقات التي يُتوقّع أنها حية لتقليل عدد الاتصالات المتزامنة.
  enableWebrtc: boolean
}) {
  const { t } = useI18n()
  const title = cam.inspectorName || cam.cameraId
  const { videoRef, status, stats } = useWebrtcViewer({
    cameraId: cam.cameraId,
    enabled: enableWebrtc && isLive,
  })

  const connected = status === "live"
  const tier = stats ? qualityTier(stats.kbps, stats.rttMs) : null
  const tierLabel: Record<"good" | "medium" | "weak", string> = {
    good: t("aiMonitoring.cam.qualGood"),
    medium: t("aiMonitoring.cam.qualMedium"),
    weak: t("aiMonitoring.cam.qualWeak"),
  }

  return (
    <Link
      href={`/ai-monitoring/live/${encodeURIComponent(cam.cameraId)}`}
      className={cn(
        "group relative aspect-video overflow-hidden rounded-xl border bg-black transition-all focus:outline-none focus:ring-2 focus:ring-ring/40",
        isLive ? "border-destructive/50" : "border-border opacity-70 hover:opacity-100",
      )}
      aria-label={t("aiMonitoring.cam.tileOpenLive").replace("{title}", title)}
    >
      {/* الفيديو الحي (يظهر فور اتصال WebRTC) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity",
          connected ? "opacity-100" : "opacity-0",
        )}
      />

      {/* التراجع إلى اللقطة عندما لا يوجد بث WebRTC متصل */}
      {!connected &&
        (cam.lastFrameUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={frameSrc(cam.lastFrameUrl, cam.lastSeenAt) || "/placeholder.svg"}
            alt={t("aiMonitoring.cam.tileLastFrame").replace("{title}", title)}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/40">
            <Cctv className="size-8" />
          </div>
        ))}

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
        {isLive ? t("aiMonitoring.cam.live") : t("aiMonitoring.cam.offline")}
      </div>

      {/* مؤشر جودة الاتصال الحي (RTT + kbps) — يظهر فقط عند اتصال WebRTC */}
      {connected && stats && tier && (
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              TIER_CLASS[tier],
            )}
          >
            <Wifi className="size-3" />
            {tierLabel[tier]}
          </span>
          <span className="rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white/90 tabular-nums">
            {stats.kbps}kbps · {stats.rttMs}ms · {stats.fps}fps
          </span>
        </div>
      )}

      {/* مؤشر "جارٍ الاتصال" أثناء تفاوض WebRTC لبطاقة حية */}
      {isLive && !connected && enableWebrtc && (
        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white/80">
          <WifiOff className="size-3 animate-pulse" />
          {t("aiMonitoring.cam.connecting")}
        </div>
      )}

      {/* شريط سفلي: الاسم والموقع */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/85 to-transparent p-2.5">
        <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
          <UserRound className="size-3.5 shrink-0" />
          <span className="truncate">{title}</span>
        </span>
        <span className="flex items-center gap-1.5 truncate text-xs text-white/70">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{cam.cameraLocation || t("aiMonitoring.cam.noLocation")}</span>
        </span>
      </div>

      {/* أيقونة الدخول عند المرور */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
        <span className="flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100">
          <Radio className="size-3.5" />
          {t("aiMonitoring.cam.watchLive")}
        </span>
      </span>
    </Link>
  )
}
