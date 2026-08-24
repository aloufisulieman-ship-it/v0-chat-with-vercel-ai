// إعادة تعيين كلمة مرور حساب مدير المنصّة بأمان.
//
// الاستخدام (لا تكتب كلمة المرور داخل الأمر مباشرةً؛ مرّرها كمتغيّر بيئة):
//   ADMIN_EMAIL=aloufisulieman@gmail.com \
//   NEW_PASSWORD='...' \
//   node --env-file-if-exists=/vercel/share/.env.project scripts/004-reset-platform-admin-password.mjs
//
// يستخدم دالة التشفير الخاصة بـ Better Auth نفسها (عبر auth.$context) لضمان توافق
// التجزئة تماماً مع تسجيل الدخول، بدل تجزئة يدوية قد لا تتطابق.

import { auth } from "../lib/auth.ts"
import { Pool } from "pg"

const email = (process.env.ADMIN_EMAIL || "aloufisulieman@gmail.com").toLowerCase()
const newPassword = process.env.NEW_PASSWORD || ""

if (!newPassword || newPassword.length < 8) {
  console.error("ERR: عيّن NEW_PASSWORD بطول 8 أحرف على الأقل عبر متغيّر بيئة.")
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

try {
  // 1) إيجاد المستخدم.
  const userRes = await pool.query(`select id, email, role, status from "user" where lower(email) = $1 limit 1`, [email])
  const user = userRes.rows[0]
  if (!user) {
    console.error(`ERR: لا يوجد مستخدم بالبريد ${email}`)
    process.exit(1)
  }

  // 2) تشفير كلمة المرور بدالة Better Auth نفسها.
  const ctx = await auth.$context
  const hash = await ctx.password.hash(newPassword)

  // 3) تحديث حساب بيانات الاعتماد (credential) أو إنشاؤه إن لم يوجد.
  const acc = await pool.query(
    `select id from account where "userId" = $1 and "providerId" = 'credential' limit 1`,
    [user.id],
  )

  if (acc.rows[0]) {
    await pool.query(`update account set password = $1, "updatedAt" = now() where id = $2`, [hash, acc.rows[0].id])
    console.log("OK: تم تحديث كلمة المرور للحساب الموجود.")
  } else {
    await pool.query(
      `insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       values (gen_random_uuid()::text, $1, 'credential', $1, $2, now(), now())`,
      [user.id, hash],
    )
    console.log("OK: تم إنشاء حساب بيانات الاعتماد وضبط كلمة المرور.")
  }

  console.log(`ACCOUNT: ${user.email} | role=${user.role} | status=${user.status}`)
} catch (e) {
  console.error("ERR:", e?.message || e)
  process.exit(1)
} finally {
  await pool.end()
}
