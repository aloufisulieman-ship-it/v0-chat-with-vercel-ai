// ترحيل 010: جداول وحدات مطابقة ISO 45001:2018 (المرحلة الثانية).
//   org_context_issue   — البند 4 (سياق المنظمة والأطراف المعنية)
//   ohs_policy          — البند 5.2 (سياسة السلامة والصحة المهنية)
//   ohs_objective       — البند 6.2 (الأهداف وخطط تحقيقها)
//   legal_requirement   — البند 6.1.3 (السجل القانوني وتقييم الالتزام)
// إضافة فقط (CREATE TABLE IF NOT EXISTS) — آمن لإعادة التشغيل.
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const statements = [
  `CREATE TABLE IF NOT EXISTS org_context_issue (
    id serial PRIMARY KEY,
    "userId" text NOT NULL,
    "organizationId" text NOT NULL,
    kind text NOT NULL DEFAULT 'internal',
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    needs text NOT NULL DEFAULT '',
    impact text NOT NULL DEFAULT 'medium',
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS org_context_issue_org_idx ON org_context_issue ("organizationId", "userId")`,

  `CREATE TABLE IF NOT EXISTS ohs_policy (
    id serial PRIMARY KEY,
    "userId" text NOT NULL,
    "organizationId" text NOT NULL,
    title text NOT NULL DEFAULT '',
    version text NOT NULL DEFAULT '1.0',
    statement text NOT NULL DEFAULT '',
    approved_by text NOT NULL DEFAULT '',
    approved_date date,
    review_date date,
    status text NOT NULL DEFAULT 'draft',
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS ohs_policy_org_idx ON ohs_policy ("organizationId", "userId")`,

  `CREATE TABLE IF NOT EXISTS ohs_objective (
    id serial PRIMARY KEY,
    "userId" text NOT NULL,
    "organizationId" text NOT NULL,
    title text NOT NULL,
    indicator text NOT NULL DEFAULT '',
    baseline text NOT NULL DEFAULT '',
    target text NOT NULL DEFAULT '',
    responsible text NOT NULL DEFAULT '',
    progress integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'not_started',
    due_date date,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS ohs_objective_org_idx ON ohs_objective ("organizationId", "userId")`,

  `CREATE TABLE IF NOT EXISTS legal_requirement (
    id serial PRIMARY KEY,
    "userId" text NOT NULL,
    "organizationId" text NOT NULL,
    title text NOT NULL,
    reference text NOT NULL DEFAULT '',
    authority text NOT NULL DEFAULT '',
    category text NOT NULL DEFAULT '',
    applicability text NOT NULL DEFAULT '',
    compliance_status text NOT NULL DEFAULT 'compliant',
    last_review_date date,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS legal_requirement_org_idx ON legal_requirement ("organizationId", "userId")`,
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
        where table_name in ('org_context_issue','ohs_policy','ohs_objective','legal_requirement')
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
