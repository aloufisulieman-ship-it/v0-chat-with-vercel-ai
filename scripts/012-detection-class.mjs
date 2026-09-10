// 012 — تصنيف الكشف (event | hazard | compliance) وتحسين دقة التصنيف.
// يضيف أعمدة detection_class و evidence_criteria إلى ai_detections، وينشئ جدول
// detection_corrections، ثم يهيّئ detection_class للسجلات القائمة من detection_type،
// ويعيد تصنيف كشوفات person_fall منخفضة الثقة (< 85%) إلى fall_risk_height.
// إضافة/تهيئة فقط — لا حذف ولا فقدان بيانات.
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// خريطة النوع → التصنيف (مطابقة لـ lib/ai-monitoring.ts).
const CLASS_BY_TYPE = {
  no_ppe: "compliance",
  no_safety_shoes: "compliance",
  no_reflective_vest: "compliance",
  traffic_congestion: "hazard",
  unsafe_stacking: "hazard",
  overspeed: "hazard",
  restricted_area: "hazard",
  pedestrian_near_forklift: "hazard",
  fall_risk_height: "hazard",
  spill_leak: "hazard",
  blocked_exit: "hazard",
  near_miss: "hazard",
  collision: "event",
  pedestrian_struck: "event",
  load_drop: "event",
  person_fall: "event",
  fire_smoke: "event",
}

async function main() {
  const c = await pool.connect()
  try {
    await c.query("begin")

    await c.query(`alter table ai_detections add column if not exists detection_class text not null default 'compliance'`)
    await c.query(`alter table ai_detections add column if not exists evidence_criteria jsonb default '{}'::jsonb`)
    await c.query(`create index if not exists ai_detections_class_idx on ai_detections (detection_class)`)

    await c.query(`
      create table if not exists detection_corrections (
        id serial primary key,
        "organizationId" text not null,
        "userId" text not null,
        detection_id integer not null,
        old_type text not null default '',
        new_type text not null default '',
        corrected_by text not null default '',
        corrected_at timestamp not null default now()
      )`)
    await c.query(`create index if not exists detection_corrections_det_idx on detection_corrections (detection_id)`)
    await c.query(`create index if not exists detection_corrections_org_idx on detection_corrections ("organizationId")`)

    // تهيئة detection_class للسجلات القائمة من نوع الكشف.
    let classified = 0
    for (const [type, klass] of Object.entries(CLASS_BY_TYPE)) {
      const r = await c.query(`update ai_detections set detection_class = $1 where detection_type = $2`, [klass, type])
      classified += r.rowCount ?? 0
    }

    // إعادة تصنيف تلقائية: person_fall بثقة < 85% ليست حدث سقوط مؤكداً بل خطر سقوط.
    const reclass = await c.query(`
      update ai_detections
         set detection_type = 'fall_risk_height',
             detection_class = 'hazard',
             review_reason = 'إعادة تصنيف تلقائية — لا يوجد دليل على حدث سقوط'
       where detection_type = 'person_fall'
         and confidence_score < 85`)

    await c.query("commit")
    console.log(`012 done — classified ${classified} rows; reclassified ${reclass.rowCount ?? 0} person_fall → fall_risk_height`)
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
