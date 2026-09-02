// ترحيل 008: تصنيف الحادثة (internal | external) على جدول incident.
// القاعدة: داخلي → الموارد البشرية، خارجي → المالية (نفس قاعدة المخالفات).
// التهيئة: السجلات المحوّلة إلى المالية تُصنَّف خارجية، وما عداها داخلية.
// إضافة فقط — آمن لإعادة التشغيل.
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const statements = [
  `ALTER TABLE incident ADD COLUMN IF NOT EXISTS classification text NOT NULL DEFAULT 'internal'`,
  // تهيئة من جهة الإحالة الحالية (routed_to أو assigned_dept من دورة الحياة).
  `UPDATE incident
      SET classification = 'external'
    WHERE classification = 'internal'
      AND (routed_to = 'finance' OR assigned_dept = 'finance')`,
  `CREATE INDEX IF NOT EXISTS incident_classification_idx ON incident (classification)`,
]

async function main() {
  const client = await pool.connect()
  try {
    for (const sql of statements) {
      await client.query(sql)
      console.log("ok:", sql.split("\n")[0].trim().slice(0, 90))
    }
    const { rows } = await client.query(
      `select classification, count(*)::int as n from incident group by classification order by classification`,
    )
    console.table(rows)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
