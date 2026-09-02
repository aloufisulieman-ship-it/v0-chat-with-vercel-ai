// ترحيل دورة الحياة الموحّدة للمخالفات والحوادث.
// - يضيف أعمدة source / lifecycle_status / assigned_dept / إحالة / إغلاق / أرشفة (IF NOT EXISTS).
// - ينشئ جدولَي record_event و app_notification.
// - يرحّل السجلات القائمة تلقائياً بالمطابقة:
//     داخلي → hr، خارجي → finance؛ closed → archived، in_review → in_progress،
//     pending مع جهة → referred، غير ذلك → new. source = ai_detection إن وُجد رصد مرتبط.
// - يدرج حدث created (و archived للمؤرشفة) في record_event.
// آمن لإعادة التشغيل: يرحّل فقط الصفوف التي لم تُرحَّل (وسم في meta الحدث).
// الاستخدام: node --env-file-if-exists=/vercel/share/.env.project scripts/006-lifecycle.mjs
import { Client } from "pg"

const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const LIFECYCLE_COLS = `
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "lifecycle_status" text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS "assigned_dept" text,
  ADD COLUMN IF NOT EXISTS "referral_notes" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "due_date" date,
  ADD COLUMN IF NOT EXISTS "referred_by" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "referred_at" timestamp,
  ADD COLUMN IF NOT EXISTS "closure_action" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "closure_evidence_url" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "lifecycle_closed_at" timestamp,
  ADD COLUMN IF NOT EXISTS "lifecycle_closed_by" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp,
  ADD COLUMN IF NOT EXISTS "reopen_reason" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "reopened_by" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "reopened_at" timestamp
`

async function run() {
  await client.query("BEGIN")
  try {
    await client.query(`ALTER TABLE "violation" ${LIFECYCLE_COLS},
      ADD COLUMN IF NOT EXISTS "ai_confidence" integer,
      ADD COLUMN IF NOT EXISTS "ai_severity" text DEFAULT '',
      ADD COLUMN IF NOT EXISTS "ai_camera_id" text DEFAULT '',
      ADD COLUMN IF NOT EXISTS "source_detection_id" integer`)
    await client.query(`ALTER TABLE "incident" ${LIFECYCLE_COLS}`)

    await client.query(`CREATE TABLE IF NOT EXISTS "record_event" (
      "id" serial PRIMARY KEY,
      "organizationId" text NOT NULL,
      "module" text NOT NULL,
      "record_id" integer NOT NULL,
      "event" text NOT NULL,
      "from_status" text DEFAULT '',
      "to_status" text DEFAULT '',
      "user_id" text DEFAULT '',
      "user_name" text DEFAULT '',
      "note" text DEFAULT '',
      "meta" text DEFAULT '',
      "created_at" timestamp NOT NULL DEFAULT now()
    )`)
    await client.query(`CREATE INDEX IF NOT EXISTS "record_event_module_record_idx" ON "record_event" ("module","record_id")`)

    await client.query(`CREATE TABLE IF NOT EXISTS "app_notification" (
      "id" serial PRIMARY KEY,
      "organizationId" text NOT NULL,
      "target_module" text NOT NULL,
      "module" text NOT NULL,
      "record_id" integer NOT NULL,
      "title" text NOT NULL,
      "message" text NOT NULL DEFAULT '',
      "read" boolean NOT NULL DEFAULT false,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`)
    await client.query(
      `CREATE INDEX IF NOT EXISTS "app_notification_org_target_idx" ON "app_notification" ("organizationId","target_module","read")`,
    )

    // ---------- الترحيل ----------
    const before = await snapshot()

    // مصدر المخالفة: رصد آلي إن وُجد اكتشاف مرتبط برقمها.
    await client.query(`UPDATE "violation" v
      SET "source" = 'ai_detection',
          "source_detection_id" = COALESCE(v."source_detection_id", d.id),
          "ai_confidence" = COALESCE(v."ai_confidence", d.confidence_score),
          "ai_severity" = CASE WHEN COALESCE(v."ai_severity",'') = '' THEN d.severity ELSE v."ai_severity" END,
          "ai_camera_id" = CASE WHEN COALESCE(v."ai_camera_id",'') = '' THEN d.camera_id ELSE v."ai_camera_id" END
      FROM "ai_detections" d
      WHERE d.linked_violation_no <> '' AND d.linked_violation_no = v."documentNo"
        AND d."organizationId" = v."organizationId"
        AND NOT EXISTS (SELECT 1 FROM "record_event" e WHERE e.module='violations' AND e.record_id=v.id AND e.event='created')`)

    for (const [table, module] of [
      ["violation", "violations"],
      ["incident", "incidents"],
    ]) {
      // الصفوف غير المُرحَّلة = لا حدث created لها.
      const rows = (
        await client.query(`SELECT t.*, t."organizationId" AS org FROM "${table}" t
          WHERE NOT EXISTS (SELECT 1 FROM "record_event" e WHERE e.module=$1 AND e.record_id=t.id AND e.event='created')`, [module])
      ).rows

      for (const r of rows) {
        const dept = r.routed_to || (r.category === "external" ? "finance" : r.category === "internal" || r.hr_status ? "hr" : null)
        const deptStatus = dept === "finance" ? r.finance_status : r.hr_status
        let lifecycle = "new"
        let archivedAt = null
        let closedAt = null
        let closedBy = ""
        let closureAction = ""
        let evidence = ""
        if (deptStatus === "closed") {
          lifecycle = "archived"
          closedAt = dept === "finance" ? r.finance_closed_at : r.hr_closed_at
          archivedAt = closedAt || r.createdAt
          closedBy = (dept === "finance" ? r.finance_closed_by : r.hr_closed_by) || ""
          closureAction = (dept === "finance" ? r.settlement_number : r.hr_action) || ""
          evidence = (dept === "finance" ? r.payment_receipt_url : "") || ""
        } else if (deptStatus === "in_review") {
          lifecycle = "in_progress"
        } else if (dept && (deptStatus === "pending" || r.routed_to || table === "violation")) {
          // للمخالفات: كل مخالفة قائمة كانت ضمنياً محالة لجهتها (داخلي→HR، خارجي→المالية).
          lifecycle = "referred"
        }
        // الحوادث بدون routed_to وبدون حالة جهة تبقى "new".
        if (table === "incident" && !r.routed_to && !r.hr_status && !r.finance_status) lifecycle = "new"

        await client.query(
          `UPDATE "${table}" SET "lifecycle_status"=$1, "assigned_dept"=$2, "referred_at"=CASE WHEN $2::text IS NULL THEN NULL ELSE "createdAt" END,
             "closure_action"=$3, "closure_evidence_url"=$4, "lifecycle_closed_at"=$5, "lifecycle_closed_by"=$6, "archived_at"=$7
           WHERE id=$8`,
          [lifecycle, lifecycle === "new" ? null : dept, closureAction, evidence, closedAt, closedBy, archivedAt, r.id],
        )

        const events = [["created", "", "new", r.createdAt]]
        if (lifecycle !== "new") events.push(["referred", "new", "referred", r.createdAt])
        if (lifecycle === "in_progress") events.push(["in_progress", "referred", "in_progress", r.createdAt])
        if (lifecycle === "archived") {
          events.push(["in_progress", "referred", "in_progress", closedAt || r.createdAt])
          events.push(["closed", "in_progress", "closed", closedAt || r.createdAt])
          events.push(["archived", "closed", "archived", archivedAt])
        }
        for (const [event, from, to, at] of events) {
          await client.query(
            `INSERT INTO "record_event" ("organizationId", module, record_id, event, from_status, to_status, user_name, note, meta, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [r.org, module, r.id, event, from, to, event === "created" ? "" : closedBy, "", JSON.stringify({ migrated: true }), at],
          )
        }
      }
      console.log(`${table}: migrated ${rows.length} rows`)
    }

    const after = await snapshot()
    await client.query("COMMIT")
    console.log("before:", JSON.stringify(before))
    console.log("after: ", JSON.stringify(after))
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  }
}

async function snapshot() {
  const out = {}
  for (const table of ["violation", "incident"]) {
    const hasCol = (
      await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='lifecycle_status'`, [table])
    ).rowCount
    if (!hasCol) {
      out[table] = "no lifecycle column yet"
      continue
    }
    const r = await client.query(`SELECT lifecycle_status, source, assigned_dept, count(*)::int n FROM "${table}" GROUP BY 1,2,3 ORDER BY 1,2,3`)
    out[table] = r.rows
  }
  return out
}

try {
  await run()
} finally {
  await client.end()
}
