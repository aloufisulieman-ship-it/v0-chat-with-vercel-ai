import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { emailAccount } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { encryptSecret } from "@/lib/email-accounts/crypto"
import { providers, isOAuthProviderId } from "@/lib/email-accounts/providers"
import { and, eq } from "drizzle-orm"

// نقطة العودة من المزوّد. تتحقق من state، تبدّل الكود برموز، تجلب عنوان البريد، وتخزّن
// الرموز مشفّرة (upsert لكل مستخدم/مزوّد)، ثم تعيد التوجيه لوجهة العودة مع مؤشّر حالة.
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params
  if (!isOAuthProviderId(provider)) return NextResponse.json({ error: "مزوّد غير مدعوم" }, { status: 404 })

  const jar = await cookies()
  const cookieName = `email_oauth_${provider}`
  const raw = jar.get(cookieName)?.value
  jar.delete(cookieName)

  const fail = (reason: string, returnTo = "/settings") =>
    NextResponse.redirect(new URL(`${returnTo}${returnTo.includes("?") ? "&" : "?"}email=${provider}:error:${encodeURIComponent(reason)}`, req.url))

  let saved: { state: string; userId: string; returnTo: string } | null = null
  try {
    saved = raw ? JSON.parse(raw) : null
  } catch {
    saved = null
  }
  if (!saved) return fail("state_missing")

  const q = req.nextUrl.searchParams
  if (q.get("error")) return fail(q.get("error_description") || q.get("error") || "denied", saved.returnTo)
  const code = q.get("code")
  if (!code || q.get("state") !== saved.state) return fail("state_mismatch", saved.returnTo)

  let user
  try {
    user = await requireUser()
  } catch {
    return NextResponse.redirect(new URL("/sign-in", req.url))
  }
  if (user.id !== saved.userId) return fail("user_mismatch", saved.returnTo)

  try {
    const p = providers[provider]
    const tokens = await p.exchangeCode(code)
    const emailAddress = await p.fetchEmailAddress(tokens.accessToken).catch(() => "")

    const values = {
      emailAddress,
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      accessTokenExpiresAt: tokens.expiresAt ?? null,
      scope: tokens.scope ?? null,
      updatedAt: new Date(),
    }
    const [existing] = await db
      .select({ id: emailAccount.id, refreshTokenEnc: emailAccount.refreshTokenEnc })
      .from(emailAccount)
      .where(and(eq(emailAccount.userId, user.id), eq(emailAccount.provider, provider)))
      .limit(1)
    if (existing) {
      await db
        .update(emailAccount)
        .set({ ...values, refreshTokenEnc: values.refreshTokenEnc ?? existing.refreshTokenEnc })
        .where(eq(emailAccount.id, existing.id))
    } else {
      await db.insert(emailAccount).values({ id: randomUUID(), userId: user.id, provider, ...values })
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "exchange_failed", saved.returnTo)
  }

  const dest = `${saved.returnTo}${saved.returnTo.includes("?") ? "&" : "?"}email=${provider}:connected`
  return NextResponse.redirect(new URL(dest, req.url))
}
