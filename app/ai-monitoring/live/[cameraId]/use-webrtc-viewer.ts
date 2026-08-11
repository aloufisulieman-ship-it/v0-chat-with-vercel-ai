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

export type ViewerStatus = "connecting" | "live"

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

  const viewerSessionIdRef = useRef<string>("")
  if (!viewerSessionIdRef.current) viewerSessionIdRef.current = makeSessionId()

  useEffect(() => {
    if (!enabled || !cameraId) return

    let stopped = false
    let pc: RTCPeerConnection | null = null
    let lastId = 0
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
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

    void startNegotiation()
    pollTimer = setInterval(tick, POLL_MS)
    scheduleRetry()

    return () => {
      stopped = true
      if (pollTimer) clearInterval(pollTimer)
      if (retryTimer) clearInterval(retryTimer)
      teardownPeer()
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [cameraId, enabled])

  return { videoRef, status, error }
}
