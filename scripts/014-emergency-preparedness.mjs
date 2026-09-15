// ترحيل وحدة التأهب للطوارئ (ISO 45001 · البند 8.2).
// - يوسّع جدول emergency_plan بأعمدة الخطة الكاملة والاعتماد بالتواقيع (ADD COLUMN IF NOT EXISTS).
// - ينشئ الجداول: emergency_contact / emergency_equipment / emergency_drill / emergency_activation.
// - يبذر جهات اتصال الطوارئ الافتراضية لكل مؤسسة (الدفاع المدني/الإسعاف 998، الطوارئ الموحّد 911...)
//   بطريقة آمنة لإعادة التشغيل (لا يكرّر نفس الجهة لنفس المؤسسة).
// آمن لإعادة التشغيل بالكامل.
// الاستخدام: node --env-file-if-exists=/vercel/share/.env.project scripts/014-emergency-preparedness.mjs
import { Client } from "pg"

// جهات اتصال الطوارئ الافتراضية (السعودية) — مرجعية ثابتة تُبذر مرة واحدة لكل مؤسسة.
const DEFAULT_CONTACTS = [
  { name: "الدفاع المدني (الإطفاء والإنقاذ)", phone: "998", contactType: "external", role: "إطفاء وإنقاذ", available247: true, sortOrder: 1 },
  { name: "الهلال الأحمر (الإسعاف)", phone: "997", contactType: "external", role: "إسعاف", available247: true, sortOrder: 2 },
  { name: "الطوارئ الموحّد", phone: "911", contactType: "external", role: "طوارئ موحّد", available247: true, sortOrder: 3 },
  { name: "الشرطة", phone: "999", contactType: "external", role: "أمن", available247: true, sortOrder: 4 },
  { name: "المرور", phone: "993", contactType: "external", role: "حوادث مرورية", available247: true, sortOrder: 5 },
  { name: "طوارئ الكهرباء", phone: "933", contactType: "external", role: "مرافق", available247: true, sortOrder: 6 },
  { name: "غرفة عمليات السلامة الداخلية", phone: "", contactType: "internal", role: "قائد الحادث", available247: true, sortOrder: 7 },
]

const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

async function addColumn(table, ddl) {
  await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS ${ddl}`)
}

async function run() {
  await client.query("BEGIN")
  try {
    // ---------- توسيع emergency_plan ----------
    await addColumn("emergency_plan", `"plan_no" text NOT NULL DEFAULT ''`)
    await addColumn("emergency_plan", `"severity" text NOT NULL DEFAULT 'medium'`)
    await addColumn("emergency_plan", `"location" text NOT NULL DEFAULT ''`)
    await addColumn("emergency_plan", `"trigger_criteria" text NOT NULL DEFAULT ''`)
    await addColumn("emergency_plan", `"response_steps" jsonb DEFAULT '[]'::jsonb`)
    await addColumn("emergency_plan", `"roles" jsonb DEFAULT '[]'::jsonb`)
    await addColumn("emergency_plan", `"assembly_point" text NOT NULL DEFAULT ''`)
    await addColumn("emergency_plan", `"review_date" date`)
    await addColumn("emergency_plan", `"preparer_signature" text NOT NULL DEFAULT ''`)
    await addColumn("emergency_plan", `"safety_signature" text NOT NULL DEFAULT ''`)
    await addColumn("emergency_plan", `"management_signature" text NOT NULL DEFAULT ''`)
    await addColumn("emergency_plan", `"approved_at" timestamp`)
    await addColumn("emergency_plan", `"approved_by" text NOT NULL DEFAULT ''`)
    await addColumn("emergency_plan", `"created_by" text NOT NULL DEFAULT ''`)
    // القيمة القديمة 'ready' → 'approved' لتتوافق مع حالات الوحدة الجديدة.
    await client.query(`UPDATE "emergency_plan" SET "status" = 'approved' WHERE "status" = 'ready'`)

    // ---------- الجداول الجديدة ----------
    await client.query(`CREATE TABLE IF NOT EXISTS "emergency_contact" (
      "id" serial PRIMARY KEY,
      "userId" text NOT NULL,
      "organizationId" text NOT NULL,
      "name" text NOT NULL,
      "phone" text NOT NULL DEFAULT '',
      "contact_type" text NOT NULL DEFAULT 'external',
      "role" text NOT NULL DEFAULT '',
      "available_247" boolean NOT NULL DEFAULT false,
      "notes" text NOT NULL DEFAULT '',
      "sort_order" integer NOT NULL DEFAULT 0,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )`)
    await client.query(
      `CREATE INDEX IF NOT EXISTS "emergency_contact_org_idx" ON "emergency_contact" ("organizationId")`,
    )
    // مفتاح تفرّد للبذر الآمن: نفس (org, name) لا يتكرر.
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "emergency_contact_org_name_idx" ON "emergency_contact" ("organizationId","name")`,
    )

    await client.query(`CREATE TABLE IF NOT EXISTS "emergency_equipment" (
      "id" serial PRIMARY KEY,
      "userId" text NOT NULL,
      "organizationId" text NOT NULL,
      "equip_type" text NOT NULL DEFAULT 'extinguisher',
      "code" text NOT NULL DEFAULT '',
      "location" text NOT NULL DEFAULT '',
      "last_check_date" date,
      "next_check_date" date,
      "status" text NOT NULL DEFAULT 'ready',
      "notes" text NOT NULL DEFAULT '',
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )`)
    await client.query(
      `CREATE INDEX IF NOT EXISTS "emergency_equipment_org_idx" ON "emergency_equipment" ("organizationId","status")`,
    )

    await client.query(`CREATE TABLE IF NOT EXISTS "emergency_drill" (
      "id" serial PRIMARY KEY,
      "userId" text NOT NULL,
      "organizationId" text NOT NULL,
      "drill_no" text NOT NULL DEFAULT '',
      "plan_id" integer,
      "drill_date" date,
      "drill_type" text NOT NULL DEFAULT 'evacuation',
      "participants" integer NOT NULL DEFAULT 0,
      "evacuation_minutes" integer NOT NULL DEFAULT 0,
      "outcome" text NOT NULL DEFAULT '',
      "notes" text NOT NULL DEFAULT '',
      "attachments" jsonb DEFAULT '[]'::jsonb,
      "created_by" text NOT NULL DEFAULT '',
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )`)
    await client.query(
      `CREATE INDEX IF NOT EXISTS "emergency_drill_org_idx" ON "emergency_drill" ("organizationId")`,
    )

    await client.query(`CREATE TABLE IF NOT EXISTS "emergency_activation" (
      "id" serial PRIMARY KEY,
      "userId" text NOT NULL,
      "organizationId" text NOT NULL,
      "activation_no" text NOT NULL DEFAULT '',
      "plan_id" integer,
      "scenario" text NOT NULL DEFAULT '',
      "description" text NOT NULL DEFAULT '',
      "reported_at" timestamp,
      "arrived_at" timestamp,
      "closed_at" timestamp,
      "outcome" text NOT NULL DEFAULT '',
      "converted_incident_id" integer,
      "created_by" text NOT NULL DEFAULT '',
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )`)
    await client.query(
      `CREATE INDEX IF NOT EXISTS "emergency_activation_org_idx" ON "emergency_activation" ("organizationId")`,
    )

    // ---------- بذر جهات الاتصال الافتراضية لكل مؤسسة ----------
    // نربط البذر بأول مستخدم (أدمن إن وُجد) لكل مؤسسة حتى يحترم userId NOT NULL و scope.
    const orgs = (await client.query(`SELECT id FROM "organization"`)).rows
    let seeded = 0
    for (const org of orgs) {
      const owner = (
        await client.query(
          `SELECT id FROM "user" WHERE "organizationId" = $1 ORDER BY (role = 'admin') DESC, "createdAt" ASC LIMIT 1`,
          [org.id],
        )
      ).rows[0]
      if (!owner) continue
      for (const c of DEFAULT_CONTACTS) {
        const res = await client.query(
          `INSERT INTO "emergency_contact"
             ("userId","organizationId","name","phone","contact_type","role","available_247","sort_order")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT ("organizationId","name") DO NOTHING`,
          [owner.id, org.id, c.name, c.phone, c.contactType, c.role, c.available247, c.sortOrder],
        )
        seeded += res.rowCount
      }
    }
    console.log(`emergency contacts seeded (new rows): ${seeded} across ${orgs.length} orgs`)

    await client.query("COMMIT")
    console.log("014-emergency-preparedness: done")
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  }
}

try {
  await run()
} finally {
  await client.end()
}
