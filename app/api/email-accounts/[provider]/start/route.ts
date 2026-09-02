import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { randomBytes } from "crypto"
import { requireUser } from "@/lib/session"
import { providers, isOAuthProviderId } from "@/lib/email-accounts/providers"

// يبدأ تدفق OAuth للمزوّد المطلوب. يحفظ state عشوائياً في كوكي HttpOnly ثم يعيد التوجيه
// إلى صفحة تفويض المزوّد. ?return=/path يحدّد وجهة العودة بعد الربط (داخل الموقع فقط).
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params
  if (!isOAuthProviderId(provider)) return NextResponse.json({ error: "مزوّد غير مدعوم" }, { status: 404 })

  let userId: string
  try {
    userId = (await requireUser()).id
  } catch {
    return NextResponse.redirect(new URL("/sign-in", req.url))
  }

  const p = providers[provider]
  if (!p.isConfigured()) {
    return NextResponse.redirect(new URL(`/settings?email=${provider}:unconfigured`, req.url))
  }

  const returnTo = req.nextUrl.searchParams.get("return") || "/settings"
  const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/settings"
  const state = randomBytes(24).toString("base64url")

  const jar = await cookies()
  jar.set(`email_oauth_${provider}`, JSON.stringify({ state, userId, returnTo: safeReturn }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  })

  return NextResponse.redirect(p.buildAuthorizeUrl(state))
}
