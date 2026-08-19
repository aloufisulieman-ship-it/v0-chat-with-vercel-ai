import { Pool } from "pg"

const EMAIL = "qa-verify-i18n@example.com"
const PASSWORD = "Test123456!"
const NAME = "QA Verify"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Import the app's better-auth instance (compiled on the fly via tsx/next is not
// available here, so we hit the auth handler through its node API by importing).
const { auth } = await import("../lib/auth.ts")

// 1. Ensure the user exists (server-side signUp bypasses the HTTP origin check).
try {
  await auth.api.signUpEmail({ body: { email: EMAIL, password: PASSWORD, name: NAME } })
  console.log("signed up")
} catch (e) {
  console.log("signup skipped:", e?.message || e)
}

// 2. Promote to approved admin so requireModule passes for every module.
await pool.query('UPDATE "user" SET role = $1, status = $2 WHERE email = $3', ["admin", "approved", EMAIL])
console.log("promoted to admin/approved")

// 3. Sign in and capture the signed session cookie.
const res = await auth.api.signInEmail({
  body: { email: EMAIL, password: PASSWORD },
  asResponse: true,
})
const setCookie = res.headers.get("set-cookie") || ""
console.log("SET_COOKIE:", setCookie)

await pool.end()
