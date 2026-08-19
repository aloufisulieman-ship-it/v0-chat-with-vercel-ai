"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPeer, pollSignals, postSignal, type IncomingSignal } from "@/lib/webrtc-client"

// خطاف المُرسِل (المفتش): يبثّ فيديو الكاميرا الحي مباشرةً إلى المدير عبر WebRTC.
//
// يعيد استخدام نفس MediaStream الخاص بالمعاينة/الرفع (getStream) فلا يفتح الكاميرا
// مرتين. أثناء التفعيل يستقصي عروض المشاهدين كل ~ثانية ويردّ على كل مشاهد بجلسة
// اتصال مستقلة، ثم ينقل الفيديو نِدّاً لِنِدّ دون المرور بالخادم.
const POLL_MS = 1000

// حد أقصى لمعدل بت الفيديو (~1.5Mbps) لتفادي إغراق رفع الجوّال وتقليل التأخير.
const MAX_VIDEO_BITRATE = 1_500_000

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
  // تدفّق صوت التحدّث القادم من المدير (talk-back) ليُشغَّل على جهاز المفتش.
  const [talkbackStream, setTalkbackStream] = useState<MediaStream | null>(null)
  // هل يتحدّث المدير الآن (مسار صوت وارد نشط وغير مكتوم)؟ لعرض مؤشر "المدير يتحدّث".
  const [managerTalking, setManagerTalking] = useState(false)
  // تدفّق مجمّع ثابت نضيف إليه مسارات الصوت الواردة من المشاهدين ونزيلها عند انتهائها.
  const talkbackStreamRef = useRef<MediaStream | null>(null)

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const lastIdRef = useRef(0)

  // استبدال مسار الفيديو المُرسَل في كل اتصالات المشاهدين القائمة دون إعادة تفاوض
  // (replaceTrack) — يُستخدم عند تبديل الكاميرا فلا ينقطع البث الحي للمدير. لا يمسّ
  // مسار الصوت ولا يعيد بناء الاتصال، فتبقى طبقات simulcast وإعدادات المُرسِل كما هي.
  const replaceVideoTrack = useCallback(async (track: MediaStreamTrack) => {
    const peers = peersRef.current
    await Promise.all(
      [...peers.values()].map(async (pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video")
        if (sender) {
          try {
            await sender.replaceTrack(track)
          } catch {
            /* بعض المتصفحات قد ترفض — نتجاهل بأمان */
          }
        }
      }),
    )
  }, [])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inspectorRef = useRef(inspectorName)
  inspectorRef.current = inspectorName

  useEffect(() => {
    if (!active) return

    let stopped = false
    const peers = peersRef.current

    const updateCount = () => setViewerCount(peers.size)

    // تدفّق مجمّع لصوت التحدّث الوارد من المشاهدين (المدير). نبقيه ثابتاً ونعرّض نسخة
    // جديدة عند تغيّر مساراته حتى يعيد عنصر <audio> ربط المصدر.
    const ensureTalkbackStream = () => {
      if (!talkbackStreamRef.current) talkbackStreamRef.current = new MediaStream()
      return talkbackStreamRef.current
    }
    const publishTalkback = () => {
      const s = talkbackStreamRef.current
      const tracks = s ? s.getAudioTracks() : []
      setTalkbackStream(tracks.length > 0 ? new MediaStream(tracks) : null)
      setManagerTalking(tracks.some((t) => t.readyState === "live" && !t.muted && t.enabled))
    }
    // ربط مسار صوت وارد من مشاهد بالتدفّق المجمّع، مع تتبّع بدء/انتهاء/كتم الحديث.
    const attachRemoteAudio = (track: MediaStreamTrack) => {
      const s = ensureTalkbackStream()
      s.addTrack(track)
      publishTalkback()
      const refresh = () => publishTalkback()
      track.addEventListener("mute", refresh)
      track.addEventListener("unmute", refresh)
      track.addEventListener("ended", () => {
        try {
          s.removeTrack(track)
        } catch {
          /* تجاهل */
        }
        publishTalkback()
      })
    }

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

      // أضف مسارات الكاميرا الحية عبر addTrack لكلٍّ من الفيديو والصوت.
      //
      // مهم: المُشاهد هو صاحب العرض (offerer) ويرسل عرضاً باتجاه recvonly لمسارين
      // فقط (فيديو ثم صوت). والكاميرا هي المُجيبة (answerer)، والإجابة يجب أن تنطبق
      // على مسارات العرض ذاتها. addTrack يُعيد استخدام المُرسِل/الـ transceiver المطابق
      // القادم من العرض تلقائياً، فيسري الفيديو والصوت معاً. أما addTransceiver فينشئ
      // مساراً (m-line) جديداً غير موجود في العرض فلا يُتفاوض عليه في الإجابة، وكانت
      // هذه سبب اختفاء الفيديو (شاشة سوداء، 0kbps) بينما يعمل الصوت.
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) pc.addTrack(videoTrack, stream)
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) pc.addTrack(audioTrack, stream)

      // استقبال صوت التحدّث (talk-back) القادم من المدير: أي مسار صوتي وارد يُوجَّه
      // إلى التدفّق المجمّع ليُشغَّل على جهاز المفتش. (الفيديو صادر فقط فلا يصلنا هنا.)
      pc.ontrack = (e) => {
        if (e.track.kind === "audio") attachRemoteAudio(e.track)
      }

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
      talkbackStreamRef.current?.getTracks().forEach((t) => t.stop())
      talkbackStreamRef.current = null
      setTalkbackStream(null)
      setManagerTalking(false)
    }
  }, [active, getStream])

  return { viewerCount, error, replaceVideoTrack, talkbackStream, managerTalking }
}
