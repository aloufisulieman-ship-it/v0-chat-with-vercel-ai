"use client"

import { useEffect, useRef, useState } from "react"
import { createPeer, pollSignals, postSignal, type IncomingSignal } from "@/lib/webrtc-client"

// خطاف المُرسِل (المفتش): يبثّ فيديو الكاميرا الحي مباشرةً إلى المدير عبر WebRTC.
//
// يعيد استخدام نفس MediaStream الخاص بالمعاينة/الرفع (getStream) فلا يفتح الكاميرا
// مرتين. أثناء التفعيل يستقصي عروض المشاهدين كل ~ثانية ويردّ على كل مشاهد بجلسة
// اتصال مستقلة، ثم ينقل الفيديو نِدّاً لِنِدّ دون المرور بالخادم.
const POLL_MS = 1000

export function useWebrtcBroadcaster(opts: {
  active: boolean
  inspectorName: string
  getStream: () => MediaStream | null
}) {
  const { active, inspectorName, getStream } = opts
  const [viewerCount, setViewerCount] = useState(0)
  // رسالة خطأ قناة الإشارات الكاملة (401/403…) لعرضها للمفتش بدل الفشل الصامت.
  const [error, setError] = useState<string | null>(null)

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const lastIdRef = useRef(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inspectorRef = useRef(inspectorName)
  inspectorRef.current = inspectorName

  useEffect(() => {
    if (!active) return

    let stopped = false
    const peers = peersRef.current

    const updateCount = () => setViewerCount(peers.size)

    const closePeer = (viewerSessionId: string) => {
      const pc = peers.get(viewerSessionId)
      if (pc) {
        try {
          pc.close()
        } catch {
          /* تجاهل */
        }
        peers.delete(viewerSessionId)
        updateCount()
      }
    }

    // إنشاء اتصال جديد للمشاهد والردّ على عرضه (offer) بإجابة (answer).
    const handleOffer = async (viewerSessionId: string, offer: RTCSessionDescriptionInit) => {
      const stream = getStream()
      if (!stream) return
      // استبدال أي اتصال قديم لنفس المشاهد (إعادة تحميل الصفحة مثلاً).
      closePeer(viewerSessionId)

      const pc = createPeer()
      peers.set(viewerSessionId, pc)
      updateCount()

      // أضف مسارات الكاميرا الحية (فيديو + صوت الميكروفون إن وُجد).
      for (const track of stream.getTracks()) pc.addTrack(track, stream)

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          void postSignal({
            role: "camera",
            viewerSessionId,
            kind: "ice",
            payload: e.candidate.toJSON(),
            inspectorName: inspectorRef.current,
          })
        }
      }
      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) closePeer(viewerSessionId)
      }

      try {
        await pc.setRemoteDescription(offer)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await postSignal({
          role: "camera",
          viewerSessionId,
          kind: "answer",
          payload: answer,
          inspectorName: inspectorRef.current,
        })
      } catch {
        closePeer(viewerSessionId)
      }
    }

    const handleSignal = async (s: IncomingSignal) => {
      if (s.kind === "offer") {
        await handleOffer(s.viewerSessionId, s.payload as RTCSessionDescriptionInit)
      } else if (s.kind === "ice") {
        const pc = peers.get(s.viewerSessionId)
        if (pc && s.payload) {
          try {
            await pc.addIceCandidate(s.payload as RTCIceCandidateInit)
          } catch {
            /* تجاهل مرشّحاً غير صالح */
          }
        }
      }
    }

    const tick = async () => {
      if (stopped) return
      const { signals, error: pollError } = await pollSignals({
        role: "camera",
        after: lastIdRef.current,
        inspectorName: inspectorRef.current,
      })
      setError(pollError)
      for (const s of signals) {
        lastIdRef.current = Math.max(lastIdRef.current, s.id)
        await handleSignal(s)
      }
    }

    void tick()
    pollRef.current = setInterval(tick, POLL_MS)

    return () => {
      stopped = true
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
      for (const pc of peers.values()) {
        try {
          pc.close()
        } catch {
          /* تجاهل */
        }
      }
      peers.clear()
      setViewerCount(0)
    }
  }, [active, getStream])

  return { viewerCount, error }
}
