// إعدادات ودوال مشتركة لعميل WebRTC (المُرسِل والمُشاهد).

// خوادم STUN عامة لاكتشاف العنوان العام واجتياز NAT في معظم الشبكات.
// ملاحظة: الشبكات ذات الـ symmetric NAT قد تحتاج خادم TURN؛ إن لزم لاحقاً
// يُضاف هنا { urls, username, credential } دون تغيير بقية الشيفرة.
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: ["stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302"] },
]

export function createPeer(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: "max-bundle" })
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
