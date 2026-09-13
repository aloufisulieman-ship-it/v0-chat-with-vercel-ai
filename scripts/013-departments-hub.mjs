// ترحيل مركز الأقسام (المرحلة 1).
// - ينشئ جداول departments / referrals / referral_events (IF NOT EXISTS) مع الفهارس.
// - يبذر الأقسام الافتراضية (HSE/HR/FIN/OPS/MNT/PRC/IT/CS/MGMT) لكل مؤسسة (ON CONFLICT DO NOTHING).
// - يحوّل إحالات المخالفات/الحوادث القائمة (assigned_dept = hr | finance، أو hr_status/finance_status)
//   إلى صفوف في referrals + حدث created (و closed للمغلقة) — دون حذف الأعمدة القديمة.
// آمن لإعادة التشغيل: لا يكرّر بذر الأقسام ولا يكرّر إحالة لنفس (org, sourceType, sourceId, toDept).
// الاستخدام: node --env-file-if-exists=/vercel/share/.env.project scripts/013-departments-hub.mjs
import { Client } from "pg"

const DEFAULT_DEPARTMENTS = [
  { code: "HSE", nameAr: "السلامة والصحة المهنية", slaHours: 24 },
  { code: "HR", nameAr: "الموارد البشرية", slaHours: 48 },
  { code: "FIN", nameAr: "المالية", slaHours: 72 },
  { code: "OPS", nameAr: "العمليات", slaHours: 48 },
  { code: "MNT", nameAr: "الصيانة", slaHours: 48 },
  { code: "PRC", nameAr: "المشتريات", slaHours: 72 },
  { code: "IT", nameAr: "تقنية المعلومات", slaHours: 48 },
  { code: "CS", nameAr: "خدمة العملاء", slaHours: 48 },
  { code: "MGMT", nameAr: "الإدارة العليا", slaHours: 48 },
]

// جهة الإحالة القديمة (hr | finance) → رمز القسم الجديد.
const DEPT_CODE_FOR_LEGACY = { hr: "HR", finance: "FIN" }

const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

async function run() {
  await client.query("BEGIN")
  try {
    // ---------- إنشاء الجداول ----------
    await client.query(`CREATE TABLE IF NOT EXISTS "departments" (
      "id" serial PRIMARY KEY,
      "organizationId" text NOT NULL,
      "code" text NOT NULL,
      "name_ar" text NOT NULL DEFAULT '',
      "manager_user_id" text,
      "email" text NOT NULL DEFAULT '',
      "sla_hours" integer NOT NULL DEFAULT 48,
      "is_active" boolean NOT NULL DEFAULT true,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )`)
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "departments_org_code_idx" ON "departments" ("organizationId","code")`,
    )

    await client.query(`CREATE TABLE IF NOT EXISTS "referrals" (
      "id" serial PRIMARY KEY,
      "organizationId" text NOT NULL,
      "ref_no" text NOT NULL DEFAULT '',
      "source_type" text NOT NULL,
      "source_id" integer NOT NULL,
      "from_dept_id" integer,
      "to_dept_id" integer NOT NULL,
      "priority" text NOT NULL DEFAULT 'medium',
      "status" text NOT NULL DEFAULT 'new',
      "assigned_to_user_id" text,
      "notes" text NOT NULL DEFAULT '',
      "closure_note" text NOT NULL DEFAULT '',
      "closure_signature_url" text NOT NULL DEFAULT '',
      "attachments" jsonb DEFAULT '[]'::jsonb,
      "due_at" timestamp,
      "created_by" text NOT NULL DEFAULT '',
      "created_by_name" text NOT NULL DEFAULT '',
      "acknowledged_at" timestamp,
      "closed_at" timestamp,
      "closed_by" text NOT NULL DEFAULT '',
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )`)
    await client.query(
      `CREATE INDEX IF NOT EXISTS "referrals_org_todept_idx" ON "referrals" ("organizationId","to_dept_id","status")`,
    )
    await client.query(
      `CREATE INDEX IF NOT EXISTS "referrals_source_idx" ON "referrals" ("organizationId","source_type","source_id")`,
    )

    await client.query(`CREATE TABLE IF NOT EXISTS "referral_events" (
      "id" serial PRIMARY KEY,
      "organizationId" text NOT NULL,
      "referral_id" integer NOT NULL,
      "actor_id" text NOT NULL DEFAULT '',
      "actor_name" text NOT NULL DEFAULT '',
      "action" text NOT NULL,
      "from_status" text NOT NULL DEFAULT '',
      "to_status" text NOT NULL DEFAULT '',
      "comment" text NOT NULL DEFAULT '',
      "created_at" timestamp NOT NULL DEFAULT now()
    )`)
    await client.query(
      `CREATE INDEX IF NOT EXISTS "referral_events_referral_idx" ON "referral_events" ("referral_id")`,
    )

    // ---------- بذر الأقسام لكل مؤسسة ----------
    const orgs = (await client.query(`SELECT id FROM "organization"`)).rows
    let seeded = 0
    for (const org of orgs) {
      for (const d of DEFAULT_DEPARTMENTS) {
        const res = await client.query(
          `INSERT INTO "departments" ("organizationId","code","name_ar","sla_hours")
           VALUES ($1,$2,$3,$4)
           ON CONFLICT ("organizationId","code") DO NOTHING`,
          [org.id, d.code, d.nameAr, d.slaHours],
        )
        seeded += res.rowCount
      }
    }
    console.log(`departments seeded (new rows): ${seeded} across ${orgs.length} orgs`)

    // خريطة (org, code) → dept id + sla.
    const deptRows = (await client.query(`SELECT id, "organizationId", code, sla_hours FROM "departments"`)).rows
    const deptByOrgCode = new Map()
    for (const r of deptRows) deptByOrgCode.set(`${r.organizationId}::${r.code}`, r)

    // ---------- تحويل الإحالات القائمة ----------
    // عدّاد REF-YYYY-### لكل مؤسسة/سنة، مُهيّأ من أي أرقام موجودة مسبقاً (لإعادة التشغيل).
    const refSeq = new Map()
    const existingRefs = (await client.query(`SELECT "organizationId", ref_no FROM "referrals" WHERE ref_no <> ''`)).rows
    for (const r of existingRefs) {
      const m = /^REF-(\d{4})-(\d+)$/.exec(r.ref_no)
      if (!m) continue
      const key = `${r.organizationId}::${m[1]}`
      const n = parseInt(m[2], 10)
      if (!refSeq.has(key) || n > refSeq.get(key)) refSeq.set(key, n)
    }
    function nextRefNo(orgId, year) {
      const key = `${orgId}::${year}`
      const n = (refSeq.get(key) ?? 0) + 1
      refSeq.set(key, n)
      return `REF-${year}-${String(n).padStart(3, "0")}`
    }

    let migrated = 0
    for (const [table, sourceType] of [
      ["violation", "violation"],
      ["incident", "incident"],
    ]) {
      // routed_to موجود في جدول الحوادث فقط؛ للمخالفات نستبدله بـ NULL حتى يوحَّد الاستعلام.
      const routedCol = table === "incident" ? "routed_to" : "NULL::text AS routed_to"
      const rows = (
        await client.query(`SELECT id, "organizationId", assigned_dept, lifecycle_status, hr_status, finance_status,
            ${routedCol}, hr_closed_at, finance_closed_at, hr_closed_by, finance_closed_by, referred_by, "createdAt"
          FROM "${table}"`)
      ).rows

      for (const r of rows) {
        const legacy = r.assigned_dept || r.routed_to || (r.finance_status ? "finance" : r.hr_status ? "hr" : null)
        if (legacy !== "hr" && legacy !== "finance") continue
        const code = DEPT_CODE_FOR_LEGACY[legacy]
        const dept = deptByOrgCode.get(`${r.organizationId}::${code}`)
        if (!dept) continue

        // لا تُكرّر إحالة لنفس السجل نحو نفس القسم.
        const dup = await client.query(
          `SELECT 1 FROM "referrals" WHERE "organizationId"=$1 AND source_type=$2 AND source_id=$3 AND to_dept_id=$4 LIMIT 1`,
          [r.organizationId, sourceType, r.id, dept.id],
        )
        if (dup.rowCount) continue

        const deptStatus = legacy === "finance" ? r.finance_status : r.hr_status
        const closedAt = legacy === "finance" ? r.finance_closed_at : r.hr_closed_at
        const closedBy = (legacy === "finance" ? r.finance_closed_by : r.hr_closed_by) || ""
        let status = "new"
        if (deptStatus === "closed" || r.lifecycle_status === "archived" || r.lifecycle_status === "closed") {
          status = "closed"
        } else if (deptStatus === "in_review" || r.lifecycle_status === "in_progress") {
          status = "in_progress"
        }

        const createdAt = r.createdAt || new Date()
        const year = new Date(createdAt).getFullYear()
        const refNo = nextRefNo(r.organizationId, year)
        const hseDept = deptByOrgCode.get(`${r.organizationId}::HSE`)
        const dueAt = new Date(new Date(createdAt).getTime() + dept.sla_hours * 3_600_000)

        const inserted = await client.query(
          `INSERT INTO "referrals"
            ("organizationId", ref_no, source_type, source_id, from_dept_id, to_dept_id, priority, status,
             notes, due_at, created_by_name, closed_at, closed_by, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,'medium',$7,'',$8,$9,$10,$11,$12,$12)
           RETURNING id`,
          [
            r.organizationId,
            refNo,
            sourceType,
            r.id,
            hseDept ? hseDept.id : null,
            dept.id,
            status,
            dueAt,
            r.referred_by || "",
            status === "closed" ? closedAt || createdAt : null,
            status === "closed" ? closedBy : "",
            createdAt,
          ],
        )
        const referralId = inserted.rows[0].id

        await client.query(
          `INSERT INTO "referral_events" ("organizationId", referral_id, action, from_status, to_status, comment, created_at)
           VALUES ($1,$2,'created','','new',$3,$4)`,
          [r.organizationId, referralId, "ترحيل تلقائي من إحالة قديمة", createdAt],
        )
        if (status === "closed") {
          await client.query(
            `INSERT INTO "referral_events" ("organizationId", referral_id, actor_name, action, from_status, to_status, created_at)
             VALUES ($1,$2,$3,'closed','new','closed',$4)`,
            [r.organizationId, referralId, closedBy, closedAt || createdAt],
          )
        }
        migrated++
      }
    }
    console.log(`referrals migrated (new rows): ${migrated}`)

    await client.query("COMMIT")

    // ملخص بعد التنفيذ.
    const summary = (
      await client.query(
        `SELECT source_type, status, count(*)::int n FROM "referrals" GROUP BY 1,2 ORDER BY 1,2`,
      )
    ).rows
    console.log("referrals summary:", JSON.stringify(summary))
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
