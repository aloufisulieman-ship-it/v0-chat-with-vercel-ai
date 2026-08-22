// يمنح دور platform_admin لحساب سليمان العوفي (مسؤول المنصّة).
// إعادة التشغيل آمنة (idempotent).
import pg from "pg"

const { Pool } = pg

const TARGET_EMAIL = process.env.PLATFORM_ADMIN_EMAIL || "aloufisulieman@gmail.com"

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const found = await pool.query(`select id, name, email, role from "user" where lower(email) = lower($1) limit 1`, [
      TARGET_EMAIL,
    ])
    if (!found.rows[0]) {
      console.error(`لم يُعثر على مستخدم بالبريد: ${TARGET_EMAIL}`)
      process.exit(1)
    }
    const before = found.rows[0]
    console.log("قبل:", before.name, "|", before.email, "| role =", before.role)

    await pool.query(
      `update "user" set role = 'platform_admin', status = 'approved', "updatedAt" = now() where lower(email) = lower($1)`,
      [TARGET_EMAIL],
    )

    const after = await pool.query(`select name, email, role, status from "user" where lower(email) = lower($1) limit 1`, [
      TARGET_EMAIL,
    ])
    const a = after.rows[0]
    console.log("بعد:", a.name, "|", a.email, "| role =", a.role, "| status =", a.status)
    console.log("تم منح دور مسؤول المنصّة بنجاح.")
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error("خطأ:", e.message)
  process.exit(1)
})
