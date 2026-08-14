"use client"

import { useEffect, useRef, useState } from "react"
import { createPeer, pollSignals, postSignal, type IncomingSignal } from "@/lib/webrtc-client"

// خطاف المُشاهد (المدير): يطلب بثاً حياً من كاميرا مفتش عبر WebRTC ويعرضه في <video>.
//
// ينشئ عرضاً (offer) من نوع استقبال-فقط ويرسله للكاميرا عبر قناة الإشارات، ثم
// يستقصي الإجابة ومرشحات ICE. عند نجاح الاتصال ينتقل الفيديو ندّاً لِند. إذا لم
// تكن الكاميرا تبث (لا إجابة) يبقى في حالة "connecting" فيسقط العرض إلى اللقطات.
const POLL_MS = 1000
const RETRY_MS = 9000
// وتيرة قياس جودة الاتصال (bitrate/rtt) عبر getStats.
const STATS_MS = 2000

export type ViewerStatus = "connecting" | "live"

// إحصاءات جودة الاتصال الحية للمُشاهد.
export type ViewerStats = {
  // معدل تدفق الفيديو الوارد بالكيلوبت/الثانية.
  kbps: number
  // زمن الذهاب والإياب بالمللي ثانية (round-trip time).
  rttMs: number
  // عدد الإطارات المستقبَلة في الثانية.
  fps: number
}

function makeSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  } catch {
    /* تجاهل */
  }
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function useWebrtcViewer(opts: { cameraId: string; enabled: boolean }) {
  const { cameraId, enabled } = opts
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<ViewerStatus>("connecting")
  // رسالة خطأ الصلاحيات/الشبكة الكاملة (مثل: "HTTP 403 — مشاهدة البث مقصورة…").
  const [error, setError] = useState<string | null>(null)
  // إحصاءات جودة الاتصال الحية (تُحدَّث كل ثانيتين أثناء البث).
  const [stats, setStats] = useState<ViewerStats | null>(null)

  const viewerSessionIdRef = useRef<string>("")
  if (!viewerSessionIdRef.current) viewerSessionIdRef.current = makeSessionId()

  useEffect(() => {
    if (!enabled || !cameraId) return

    let stopped = false
    let pc: RTCPeerConnection | null = null
    let lastId = 0
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let statsTimer: ReturnType<typeof setInterval> | null = null
    // للحساب التفاضلي لمعدل التدفق: آخر قراءة للبايتات/الإطارات والزمن.
    let lastBytes = 0
    let lastFrames = 0
    let lastStatsTs = 0
    const viewerSessionId = viewerSessionIdRef.current

    const teardownPeer = () => {
      if (pc) {
        try {
          pc.close()
        } catch {
          /* تجاهل */
        }
        pc = null
      }
    }

    // إنشاء اتصال جديد وإرسال عرض استقبال-فقط إلى الكاميرا.
    const startNegotiation = async () => {
      teardownPeer()
      if (stopped) return
      setStatus("connecting")
      pc = createPeer()

      pc.addTransceiver("video", { direction: "recvonly" })
      // استقبال الصوت أيضاً (صوت الميكروفون من كاميرا المفتش).
      pc.addTransceiver("audio", { direction: "recvonly" })

      pc.ontrack = (e) => {
        if (videoRef.current && e.streams[0]) {
          videoRef.current.srcObject = e.streams[0]
          void videoRef.current.play().catch(() => {})
        }
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          void postSignal({
            role: "viewer",
            viewerSessionId,
            kind: "ice",
            payload: e.candidate.toJSON(),
            cameraId,
          })
        }
      }
      pc.onconnectionstatechange = () => {
        if (!pc) return
        if (pc.connectionState === "connected") setStatus("live")
        else if (["failed", "disconnected", "closed"].includes(pc.connectionState)) setStatus("connecting")
      }

      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await postSignal({ role: "viewer", viewerSessionId, kind: "offer", payload: offer, cameraId })
      } catch {
        /* ستُعاد المحاولة دورياً */
      }
    }

    const handleSignal = async (s: IncomingSignal) => {
      if (!pc) return
      if (s.kind === "answer") {
        try {
          await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit)
        } catch {
          /* تجاهل */
        }
      } else if (s.kind === "ice" && s.payload) {
        try {
          await pc.addIceCandidate(s.payload as RTCIceCandidateInit)
        } catch {
          /* تجاهل */
        }
      }
    }

    const tick = async () => {
      if (stopped) return
      const { signals, error: pollError } = await pollSignals({
        role: "viewer",
        after: lastId,
        viewerSessionId,
        cameraId,
      })
      // إظهار رسالة الخطأ الحقيقية (401/403…) بدل بقاء الحالة "جارٍ الاتصال" بلا سبب.
      setError(pollError)
      for (const s of signals) {
        lastId = Math.max(lastId, s.id)
        await handleSignal(s)
      }
    }

    // إعادة المحاولة دورياً إن لم يكتمل الاتصال (الكاميرا قد تبدأ البث لاحقاً).
    const scheduleRetry = () => {
      retryTimer = setInterval(() => {
        if (stopped) return
        if (!pc || pc.connectionState !== "connected") void startNegotiation()
      }, RETRY_MS)
    }

    // قياس جودة الاتصال: نقرأ inbound-rtp للفيديو ونشتق معدل التدفق وعدد الإطارات،
    // وncandidate-pair النشط لزمن الذهاب والإياب (RTT).
    const sampleStats = async () => {
      if (stopped || !pc || pc.connectionState !== "connected") return
      try {
        const report = await pc.getStats()
        let bytes = 0
        let frames = 0
        let rttMs = 0
        const now = Date.now()
        report.forEach((s) => {
          if (s.type === "inbound-rtp" && (s as { kind?: string }).kind === "video") {
            bytes = (s as { bytesReceived?: number }).bytesReceived ?? bytes
            frames = (s as { framesDecoded?: number }).framesDecoded ?? frames
          }
          if (s.type === "candidate-pair" && (s as { nominated?: boolean }).nominated) {
            const rtt = (s as { currentRoundTripTime?: number }).currentRoundTripTime
            if (typeof rtt === "number") rttMs = Math.round(rtt * 1000)
          }
        })
        if (lastStatsTs > 0) {
          const dt = (now - lastStatsTs) / 1000
          if (dt > 0) {
            const kbps = Math.max(0, Math.round(((bytes - lastBytes) * 8) / 1000 / dt))
            const fps = Math.max(0, Math.round((frames - lastFrames) / dt))
            setStats({ kbps, rttMs, fps })
          }
        }
        lastBytes = bytes
        lastFrames = frames
        lastStatsTs = now
      } catch {
        /* تجاهل قراءة فاشلة */
      }
    }

    void startNegotiation()
    pollTimer = setInterval(tick, POLL_MS)
    statsTimer = setInterval(sampleStats, STATS_MS)
    scheduleRetry()

    return () => {
      stopped = true
      if (pollTimer) clearInterval(pollTimer)
      if (retryTimer) clearInterval(retryTimer)
      if (statsTimer) clearInterval(statsTimer)
      setStats(null)
      teardownPeer()
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [cameraId, enabled])

  return { videoRef, status, error, stats }
}
