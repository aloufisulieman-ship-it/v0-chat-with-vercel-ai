// ترحيل غير مُتلِف لتحويل النظام إلى متعدد المؤسسات (multi-tenant).
//
// ما يفعله هذا السكربت داخل معاملة واحدة (transaction):
//   1) ينشئ جدول organization إن لم يكن موجوداً.
//   2) يضيف عمود organizationId (nullable مؤقتاً) لكل جدول تشغيلي + جدول user.
//   3) ينشئ "المؤسسة الأولى" (إن لم توجد مؤسسة بعد) ويجعل أقدم مدير مالكاً لها.
//   4) يعبّئ organizationId رجعياً لكل الصفوف الحالية = المؤسسة الأولى.
//   5) يفرض NOT NULL بعد اكتمال التعبئة.
//
// آمن للتشغيل أكثر من مرة (idempotent): كل خطوة محميّة بـ IF NOT EXISTS / WHERE IS NULL.
// لا يحذف ولا يعدّل أي محتوى فعلي — يضيف الربط بالمؤسسة فقط.
//
// التشغيل:
//   node --env-file-if-exists=/vercel/share/.env.project scripts/001-add-organizations.mjs

import pg from "pg"
import { randomUUID } from "node:crypto"

const { Pool } = pg

// كل الجداول التي تحمل عمود organizationId (بالاسم الفعلي في قاعدة البيانات).
const SCOPED_TABLES = [
  "company",
  "incident",
  "inspection",
  "permit",
  "risk",
  "training",
  "employees",
  "toolbox_session",
  "toolbox_attendee",
  "training_attendee",
  "corrective_action",
  "audit",
  "violation",
  "observation",
  "attachment",
  "ai_detections",
  "ai_monitoring_notifications",
  "active_camera_streams",
  "video_recordings",
  "video_screenshots",
  "document",
  "plate_reads",
  "employee_id_reads",
  "tuktuk_reads",
]

const ORG_NAME = "المؤسسة الأولى"

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // 1) جدول المؤسسات.
    await client.query(`
      CREATE TABLE IF NOT EXISTS "organization" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL DEFAULT '',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    // 2) إضافة العمود (nullable مؤقتاً) لجدول user وكل الجداول التشغيلية.
    await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "organizationId" text`)
    for (const table of SCOPED_TABLES) {
      await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "organizationId" text`)
    }

    // 3) تحديد/إنشاء المؤسسة الأولى ومالكها (أقدم مدير، وإلا أقدم مستخدم).
    const existingOrg = await client.query(`SELECT "id" FROM "organization" ORDER BY "createdAt" ASC LIMIT 1`)
    let orgId
    if (existingOrg.rows.length > 0) {
      orgId = existingOrg.rows[0].id
      console.log(`[migrate] using existing organization: ${orgId}`)
    } else {
      orgId = `org_${randomUUID()}`
      await client.query(`INSERT INTO "organization" ("id", "name") VALUES ($1, $2)`, [orgId, ORG_NAME])
      console.log(`[migrate] created first organization: ${orgId} ("${ORG_NAME}")`)
    }

    // 4) تعبئة رجعية: كل صف بلا مؤسسة يُنسب إلى المؤسسة الأولى.
    const userBackfill = await client.query(
      `UPDATE "user" SET "organizationId" = $1 WHERE "organizationId" IS NULL`,
      [orgId],
    )
    console.log(`[migrate] user rows backfilled: ${userBackfill.rowCount}`)

    for (const table of SCOPED_TABLES) {
      const res = await client.query(
        `UPDATE "${table}" SET "organizationId" = $1 WHERE "organizationId" IS NULL`,
        [orgId],
      )
      console.log(`[migrate] ${table} rows backfilled: ${res.rowCount}`)
    }

    // 5) فرض NOT NULL بعد اكتمال التعبئة (آمن لأن كل الصفوف صارت مملوءة).
    await client.query(`ALTER TABLE "user" ALTER COLUMN "organizationId" SET NOT NULL`)
    for (const table of SCOPED_TABLES) {
      await client.query(`ALTER TABLE "${table}" ALTER COLUMN "organizationId" SET NOT NULL`)
    }

    // فهارس تسريع الفلترة على مستوى المؤسسة (اختياري لكنه مفيد للأداء).
    await client.query(`CREATE INDEX IF NOT EXISTS "user_organizationId_idx" ON "user" ("organizationId")`)
    for (const table of SCOPED_TABLES) {
      await client.query(
        `CREATE INDEX IF NOT EXISTS "${table}_organizationId_idx" ON "${table}" ("organizationId")`,
      )
    }

    await client.query("COMMIT")
    console.log("[migrate] SUCCESS — multi-tenant migration committed.")
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("[migrate] FAILED — rolled back. No changes applied.")
    console.error(err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
