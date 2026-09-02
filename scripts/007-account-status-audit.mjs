// ترحيل 007: حالة الحساب (active/suspended/banned)، آخر دخول فعلي، وسجل تدقيق المستخدمين.
// إضافة فقط — لا حذف ولا تعديل لبيانات قائمة. آمن لإعادة التشغيل.
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const statements = [
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_login_at timestamp`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_login_ip text DEFAULT ''`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_login_device text DEFAULT ''`,
  `CREATE TABLE IF NOT EXISTS user_audit_log (
     id serial PRIMARY KEY,
     actor_id text NOT NULL,
     actor_name text NOT NULL DEFAULT '',
     actor_email text NOT NULL DEFAULT '',
     target_user_id text NOT NULL,
     target_email text NOT NULL DEFAULT '',
     action text NOT NULL,
     field text NOT NULL DEFAULT '',
     old_value text DEFAULT '',
     new_value text DEFAULT '',
     note text DEFAULT '',
     ip text DEFAULT '',
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS user_audit_log_target_idx ON user_audit_log (target_user_id)`,
  `CREATE INDEX IF NOT EXISTS user_audit_log_created_idx ON user_audit_log (created_at)`,
  // تهيئة آخر دخول للحسابات القائمة من آخر جلسة معروفة (مرة واحدة، فقط حيث القيمة فارغة).
  `UPDATE "user" u SET last_login_at = s.last_seen
     FROM (SELECT "userId", max("updatedAt") AS last_seen FROM session GROUP BY "userId") s
    WHERE s."userId" = u.id AND u.last_login_at IS NULL`,
]

async function main() {
  const client = await pool.connect()
  try {
    for (const sql of statements) {
      await client.query(sql)
    }
    const r = await client.query(
      `SELECT account_status, count(*)::int AS n FROM "user" GROUP BY 1 ORDER BY 1`,
    )
    console.log("account_status distribution:", r.rows)
    const l = await client.query(`SELECT count(*)::int AS with_login FROM "user" WHERE last_login_at IS NOT NULL`)
    console.log("users with last_login_at:", l.rows[0].with_login)
    console.log("migration 007 done")
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
