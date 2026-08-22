import "server-only"
import { cookies } from "next/headers"
import { createHmac, timingSafeEqual } from "crypto"

// سياق "الدخول إلى مؤسسة" لمسؤول المنصّة. نخزّن معرّف المؤسسة الهدف في كوكي موقّع
// (HMAC عبر BETTER_AUTH_SECRET) بحيث لا يمكن للعميل تزويره. لا يُفعّل هذا السياق إلا
// عندما يكون دور المستخدم platform_admin (يُتحقق منه في طبقة الجلسة، لا هنا).

const COOKIE_NAME = "v0_pa_org"
const MAX_AGE = 60 * 60 * 8 // 8 ساعات

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET
  if (!s) throw new Error("BETTER_AUTH_SECRET غير مضبوط")
  return s
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url")
}

// صيغة الكوكي: "<orgId>.<signature>". نتحقق بمقارنة ثابتة الزمن.
function serialize(orgId: string): string {
  return `${orgId}.${sign(orgId)}`
}

function deserialize(raw: string | undefined): string | null {
  if (!raw) return null
  const idx = raw.lastIndexOf(".")
  if (idx <= 0) return null
  const orgId = raw.slice(0, idx)
  const sig = raw.slice(idx + 1)
  const expected = sign(orgId)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return orgId
}

// يقرأ معرّف المؤسسة الحالية المدخول إليها (بعد التحقق من التوقيع). نقي تماماً — لا
// يتحقق من الدور؛ طبقة الجلسة هي من يطبّق قيد platform_admin.
export async function getEnteredOrgId(): Promise<string | null> {
  const store = await cookies()
  return deserialize(store.get(COOKIE_NAME)?.value)
}

export async function setEnteredOrg(orgId: string): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, serialize(orgId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  })
}

export async function clearEnteredOrg(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
