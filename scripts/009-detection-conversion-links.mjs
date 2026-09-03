// 009 — روابط تحويل الكشوفات الذكية إلى سجلات رسمية.
// يضيف converted_to_incident_id و converted_to_violation_id إلى ai_detections ثم يهيّئ
// رابط المخالفة من linked_violation_no / violation.source_detection_id القائمة.
// إضافة فقط — لا حذف ولا تغيير في البيانات القائمة.
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const c = await pool.connect()
  try {
    await c.query("begin")
    await c.query(`alter table ai_detections add column if not exists converted_to_incident_id integer`)
    await c.query(`alter table ai_detections add column if not exists converted_to_violation_id integer`)
    await c.query(`create index if not exists ai_detections_conv_inc_idx on ai_detections (converted_to_incident_id)`)
    await c.query(`create index if not exists ai_detections_conv_vio_idx on ai_detections (converted_to_violation_id)`)

    // تهيئة رابط المخالفة من الرابط العكسي (violation.source_detection_id) أولاً، ثم من رقم المستند.
    const a = await c.query(`
      update ai_detections d
         set converted_to_violation_id = v.id
        from violation v
       where d.converted_to_violation_id is null
         and v.source_detection_id = d.id
         and v."organizationId" = d."organizationId"`)
    const b = await c.query(`
      update ai_detections d
         set converted_to_violation_id = v.id
        from violation v
       where d.converted_to_violation_id is null
         and coalesce(d.linked_violation_no, '') <> ''
         and v."documentNo" = d.linked_violation_no
         and v."organizationId" = d."organizationId"`)
    await c.query("commit")
    console.log(`009 done — backfilled violation links: ${a.rowCount} (by source id) + ${b.rowCount} (by document no)`)
  } catch (e) {
    await c.query("rollback")
    throw e
  } finally {
    c.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
