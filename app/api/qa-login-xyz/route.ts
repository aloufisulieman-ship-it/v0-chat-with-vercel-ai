import { auth } from "@/lib/auth"
import { pool } from "@/lib/db"
import { NextResponse } from "next/server"

const EMAIL = "qa-verify-i18n@example.com"
const PASSWORD = "Test123456!"
const NAME = "QA Verify"

// TEMPORARY QA-only route for browser verification. Delete after use.
export async function GET() {
  try {
    await auth.api.signUpEmail({ body: { email: EMAIL, password: PASSWORD, name: NAME } })
  } catch {
    // already exists
  }
  await pool.query('UPDATE "user" SET role = $1, status = $2 WHERE email = $3', ["admin", "approved", EMAIL])

  const res = await auth.api.signInEmail({
    body: { email: EMAIL, password: PASSWORD },
    asResponse: true,
  })

  const out = NextResponse.json({ ok: true })
  const setCookie = res.headers.get("set-cookie")
  if (setCookie) out.headers.set("set-cookie", setCookie)
  return out
}
