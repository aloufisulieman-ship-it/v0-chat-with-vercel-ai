"use client"

import { useEffect, useRef, useState } from "react"
import { createPeer, pollSignals, postSignal, type IncomingSignal } from "@/lib/webrtc-client"

// خطاف المُرسِل (المفتش): يبثّ فيديو الكاميرا الحي مباشرةً إلى المدير عبر WebRTC.
//
// يعيد استخدام نفس MediaStream الخاص بالمعاينة/الرفع (getStream) فلا يفتح الكاميرا
// مرتين. أثناء التفعيل يستقصي عروض المشاهدين كل ~ثانية ويردّ على كل مشاهد بجلسة
// اتصال مستقلة، ثم ينقل الفيديو نِدّاً لِنِدّ دون المرور بالخادم.
const POLL_MS = 1000

// حد أقصى لمعدل بت الفيديو (~1.5Mbps) لتفادي إغراق رفع الجوّال وتقليل التأخير.
const MAX_VIDEO_BITRATE = 1_500_000
// طبقات simulcast: يرسل الناشر ثلاث دقّات متزامنة (كاملة/نصف/ربع) فيختار المتصفح
// الطبقة المناسبة تلقائياً حسب جودة شبكة كل مشاهد — تكيّف حقيقي مع الشبكة.
const SIMULCAST_ENCODINGS: RTCRtpEncodingParameters[] = [
  { rid: "h", maxBitrate: MAX_VIDEO_BITRATE, scaleResolutionDownBy: 1 },
  { rid: "m", maxBitrate: 600_000, scaleResolutionDownBy: 2 },
  { rid: "l", maxBitrate: 200_000, scaleResolutionDownBy: 4 },
]

// ضبط معدل البت وتفضيل التدهور على مُرسِل الفيديو بعد إنشاء الاتصال:
// - maxBitrate يحدّ من الإغراق.
// - degradationPreference="maintain-framerate" يُبقي السلاسة ويخفض الدقة عند الضغط
//   (حسب اختيار المستخدم: حفظ معدل الإطارات).
async function tuneVideoSender(pc: RTCPeerConnection) {
  const sender = pc.getSenders().find((s) => s.track?.kind === "video")
  if (!sender) return
  try {
    const params = sender.getParameters()
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}]
    }
    for (const enc of params.encodings) {
      enc.maxBitrate = Math.min(enc.maxBitrate ?? MAX_VIDEO_BITRATE, MAX_VIDEO_BITRATE)
    }
    ;(params as { degradationPreference?: string }).degradationPreference = "maintain-framerate"
    await sender.setParameters(params)
  } catch {
    /* بعض المتصفحات لا تدعم كل الحقول — نتجاهل بأمان */
  }
}

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

      // أضف مسارات الكاميرا الحية:
      // - الفيديو عبر addTransceiver مع طبقات simulcast للتكيّف مع الشبكة.
      // - الصوت عبر addTrack عادي.
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        pc.addTransceiver(videoTrack, {
          direction: "sendonly",
          streams: [stream],
          sendEncodings: SIMULCAST_ENCODINGS,
        })
      }
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) pc.addTrack(audioTrack, stream)

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
        // ضبط معدل البت التكيّفي بعد اكتمال التفاوض (يتطلب وجود المُرسِل).
        await tuneVideoSender(pc)
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
