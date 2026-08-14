// إعدادات ودوال مشتركة لعميل WebRTC (المُرسِل والمُشاهد).

// خوادم STUN عامة لاكتشاف العنوان العام واجتياز NAT في معظم الشبكات.
const STUN_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: ["stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302"] },
]

// خادم TURN اختياري يُهيّأ عبر متغيرات بيئة عامة (client-side). لازمٌ للشبكات ذات
// الـ symmetric NAT / الجوّال حيث يفشل STUN وحده في تأسيس مسار مباشر. يدعم عدة
// عناوين مفصولة بفواصل (udp/tcp/tls) لأفضل احتمال نجاح.
//
//   NEXT_PUBLIC_TURN_URL=turn:turn.example.com:3478,turns:turn.example.com:5349
//   NEXT_PUBLIC_TURN_USERNAME=...
//   NEXT_PUBLIC_TURN_CREDENTIAL=...
//
// عند غياب هذه المتغيرات نتراجع تلقائياً إلى STUN فقط (سلوك سابق دون كسر).
function turnServer(): RTCIceServer | null {
  const url = process.env.NEXT_PUBLIC_TURN_URL
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL
  if (!url) return null
  const urls = url
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
  if (urls.length === 0) return null
  return { urls, username, credential }
}

// هل تمّت تهيئة TURN؟ (يُعرَض في مؤشر التشخيص على الجدار وصفحة الكاميرا).
export const HAS_TURN = !!process.env.NEXT_PUBLIC_TURN_URL

// قائمة خوادم ICE النهائية: STUN دائماً + TURN إن هُيّئ.
export const ICE_SERVERS: RTCIceServer[] = (() => {
  const turn = turnServer()
  return turn ? [...STUN_SERVERS, turn] : STUN_SERVERS
})()

// لتشخيص فشل المسار المباشر: ضبط NEXT_PUBLIC_FORCE_TURN=1 يجبر استخدام relay فقط،
// فإن نجح البث حينها عرفنا أن المشكلة في عبور NAT وأن TURN هو الحل.
const FORCE_RELAY = process.env.NEXT_PUBLIC_FORCE_TURN === "1"

export function createPeer(): RTCPeerConnection {
  const config: RTCConfiguration = {
    iceServers: ICE_SERVERS,
    bundlePolicy: "max-bundle",
  }
  if (FORCE_RELAY && HAS_TURN) config.iceTransportPolicy = "relay"
  return new RTCPeerConnection(config)
}

export type SignalKind = "offer" | "answer" | "ice"

export type IncomingSignal = {
  id: number
  viewerSessionId: string
  kind: SignalKind
  payload: unknown
}

const ENDPOINT = "/api/ai-monitoring/webrtc"

// استخراج رسالة الخطأ الكاملة من استجابة غير ناجحة (بدل الاكتفاء برمز الحالة).
async function readError(res: Response): Promise<string> {
  let detail = ""
  try {
    const data = (await res.json()) as { error?: string }
    detail = data?.error || ""
  } catch {
    /* الجسم ليس JSON */
  }
  return `HTTP ${res.status}${detail ? ` — ${detail}` : ""}`
}

// إرسال إشارة إلى الطرف الآخر عبر قناة قاعدة البيانات.
// يعيد رسالة الخطأ الكاملة عند الفشل (أو null عند النجاح) لعرضها/تسجيلها.
export async function postSignal(input: {
  role: "camera" | "viewer"
  viewerSessionId: string
  kind: SignalKind
  payload: unknown
  cameraId?: string
  inspectorName?: string
}): Promise<{ error: string | null }> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const error = await readError(res)
      console.log("[v0] webrtc postSignal failed:", error)
      return { error }
    }
    return { error: null }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.log("[v0] webrtc postSignal network error:", error)
    return { error }
  }
}

// استقصاء الإشارات الجديدة (id > after) القادمة من الطرف الآخر.
// يُرجع أيضاً رسالة الخطأ الكاملة عند الفشل لعرضها للمستخدم بدل إخفاء رمز 401/403.
export async function pollSignals(input: {
  role: "camera" | "viewer"
  after: number
  viewerSessionId?: string
  cameraId?: string
  inspectorName?: string
}): Promise<{ signals: IncomingSignal[]; cameraId: string; error: string | null }> {
  const p = new URLSearchParams()
  p.set("role", input.role)
  p.set("after", String(input.after))
  if (input.viewerSessionId) p.set("viewerSessionId", input.viewerSessionId)
  if (input.cameraId) p.set("cameraId", input.cameraId)
  if (input.inspectorName) p.set("inspectorName", input.inspectorName)
  try {
    const res = await fetch(`${ENDPOINT}?${p.toString()}`)
    if (!res.ok) {
      const error = await readError(res)
      console.log("[v0] webrtc pollSignals failed:", error)
      return { signals: [], cameraId: "", error }
    }
    const data = (await res.json()) as { signals: IncomingSignal[]; cameraId: string }
    return { ...data, error: null }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.log("[v0] webrtc pollSignals network error:", error)
    return { signals: [], cameraId: "", error }
  }
}
