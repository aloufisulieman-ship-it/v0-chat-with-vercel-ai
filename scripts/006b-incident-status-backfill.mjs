// ترحيل تكميلي: الحوادث غير المحالة لجهة (بلا routed_to/hr_status/finance_status)
// تُشتق حالتها في دورة الحياة من حقل status القديم:
//   closed → archived (مغلقة ثم مؤرشفة تلقائياً)، investigating|in_progress → in_progress
//   (بلا جهة محددة)، open → new. آمن للتكرار: لا يعيد كتابة سجلات سبق تعديلها ولا يكرر الأحداث.
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()
try {
  await client.query("BEGIN")
  const { rows } = await client.query(
    `SELECT id, "organizationId" AS org, status, "createdAt", "lifecycle_status"
       FROM incident
      WHERE routed_to IS NULL AND hr_status IS NULL AND finance_status IS NULL AND "lifecycle_status" = 'new'`,
  )
  let changed = 0
  for (const r of rows) {
    let lifecycle = "new"
    if (r.status === "closed") lifecycle = "archived"
    else if (r.status === "investigating" || r.status === "in_progress") lifecycle = "in_progress"
    if (lifecycle === "new") continue

    await client.query(
      `UPDATE incident SET "lifecycle_status"=$1,
         "lifecycle_closed_at"=CASE WHEN $1='archived' THEN "createdAt" END,
         "archived_at"=CASE WHEN $1='archived' THEN "createdAt" END
       WHERE id=$2`,
      [lifecycle, r.id],
    )
    const events = [["in_progress", "new", "in_progress"]]
    if (lifecycle === "archived") events.push(["closed", "in_progress", "closed"], ["archived", "closed", "archived"])
    for (const [event, from, to] of events) {
      await client.query(
        `INSERT INTO record_event ("organizationId", module, record_id, event, from_status, to_status, note, meta, created_at)
         SELECT $1,'incidents',$2,$3,$4,$5,'',$6,$7
         WHERE NOT EXISTS (SELECT 1 FROM record_event WHERE module='incidents' AND record_id=$2 AND event=$3)`,
        [r.org, r.id, event, from, to, JSON.stringify({ migrated: true, fromLegacyStatus: r.status }), r.createdAt],
      )
    }
    changed++
  }
  const after = await client.query(`SELECT "lifecycle_status", count(*)::int n FROM incident GROUP BY 1 ORDER BY 1`)
  await client.query("COMMIT")
  console.log(`incident: adjusted ${changed} rows`)
  console.table(after.rows)
} catch (e) {
  await client.query("ROLLBACK")
  throw e
} finally {
  client.release()
  await pool.end()
}
