// ترحيل 011: جداول وحدات مطابقة ISO 45001:2018 التشغيلية (المرحلة الثالثة).
//   worker_consultation  — البند 5.4 (تشاور العمال ومشاركتهم)
//   emergency_plan       — البند 8.2 (التأهب للطوارئ والاستجابة)
//   contractor           — البند 8.1.4 (المقاولون والمشتريات)
//   management_review    — البند 9.3 (مراجعة الإدارة)
//   internal_audit       — البند 9.2 (التدقيق الداخلي)
// إضافة فقط (CREATE TABLE IF NOT EXISTS) — آمن لإعادة التشغيل.
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const statements = [
  `CREATE TABLE IF NOT EXISTS worker_consultation (
    id serial PRIMARY KEY,
    "userId" text NOT NULL,
    "organizationId" text NOT NULL,
    topic text NOT NULL,
    activity_type text NOT NULL DEFAULT 'consultation',
    method text NOT NULL DEFAULT 'meeting',
    participants integer NOT NULL DEFAULT 0,
    outcome text NOT NULL DEFAULT '',
    activity_date date,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS worker_consultation_org_idx ON worker_consultation ("organizationId", "userId")`,

  `CREATE TABLE IF NOT EXISTS emergency_plan (
    id serial PRIMARY KEY,
    "userId" text NOT NULL,
    "organizationId" text NOT NULL,
    scenario text NOT NULL,
    plan_type text NOT NULL DEFAULT 'fire',
    responsible_team text NOT NULL DEFAULT '',
    last_drill_date date,
    next_drill_date date,
    status text NOT NULL DEFAULT 'ready',
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS emergency_plan_org_idx ON emergency_plan ("organizationId", "userId")`,

  `CREATE TABLE IF NOT EXISTS contractor (
    id serial PRIMARY KEY,
    "userId" text NOT NULL,
    "organizationId" text NOT NULL,
    name text NOT NULL,
    scope text NOT NULL DEFAULT '',
    hse_rating integer NOT NULL DEFAULT 0,
    evaluation_date date,
    status text NOT NULL DEFAULT 'approved',
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS contractor_org_idx ON contractor ("organizationId", "userId")`,

  `CREATE TABLE IF NOT EXISTS management_review (
    id serial PRIMARY KEY,
    "userId" text NOT NULL,
    "organizationId" text NOT NULL,
    title text NOT NULL,
    review_date date,
    attendees text NOT NULL DEFAULT '',
    inputs text NOT NULL DEFAULT '',
    decisions text NOT NULL DEFAULT '',
    next_review_date date,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS management_review_org_idx ON management_review ("organizationId", "userId")`,

  `CREATE TABLE IF NOT EXISTS internal_audit (
    id serial PRIMARY KEY,
    "userId" text NOT NULL,
    "organizationId" text NOT NULL,
    title text NOT NULL,
    scope text NOT NULL DEFAULT '',
    auditor text NOT NULL DEFAULT '',
    audit_date date,
    nonconformities integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'planned',
    result text NOT NULL DEFAULT '',
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS internal_audit_org_idx ON internal_audit ("organizationId", "userId")`,
]

async function main() {
  const client = await pool.connect()
  try {
    for (const sql of statements) {
      await client.query(sql)
      console.log("ok:", sql.split("\n")[0].trim().slice(0, 70))
    }
    const { rows } = await client.query(
      `select table_name from information_schema.tables
        where table_name in ('worker_consultation','emergency_plan','contractor','management_review','internal_audit')
        order by table_name`,
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
