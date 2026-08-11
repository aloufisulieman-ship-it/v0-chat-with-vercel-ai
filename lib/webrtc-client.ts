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

// إرسال إشارة إلى الطرف الآخر عبر قناة قاعدة البيانات.
export async function postSignal(input: {
  role: "camera" | "viewer"
  viewerSessionId: string
  kind: SignalKind
  payload: unknown
  cameraId?: string
  inspectorName?: string
}): Promise<void> {
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  } catch {
    /* تجاهل — سيعاد المحاولة في الدورة التالية */
  }
}

// استقصاء الإشارات الجديدة (id > after) القادمة من الطرف الآخر.
export async function pollSignals(input: {
  role: "camera" | "viewer"
  after: number
  viewerSessionId?: string
  cameraId?: string
  inspectorName?: string
}): Promise<{ signals: IncomingSignal[]; cameraId: string }> {
  const p = new URLSearchParams()
  p.set("role", input.role)
  p.set("after", String(input.after))
  if (input.viewerSessionId) p.set("viewerSessionId", input.viewerSessionId)
  if (input.cameraId) p.set("cameraId", input.cameraId)
  if (input.inspectorName) p.set("inspectorName", input.inspectorName)
  try {
    const res = await fetch(`${ENDPOINT}?${p.toString()}`)
    if (!res.ok) return { signals: [], cameraId: "" }
    return (await res.json()) as { signals: IncomingSignal[]; cameraId: string }
  } catch {
    return { signals: [], cameraId: "" }
  }
}
