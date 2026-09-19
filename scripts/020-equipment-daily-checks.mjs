// ترحيل وحدة الفحص اليومي قبل التشغيل للمعدات (OSHA 29 CFR 1910.178(q)(7) · ISO 45001 §8.1).
// - يوسّع جدول equipment بعمودَي power_type و qr_token، ويبذر رمز QR فريداً لكل معدة.
// - ينشئ الجداول: equipment_checklist_item / equipment_daily_check /
//   equipment_daily_check_item / maintenance_ticket.
// - يبذر بنود قائمة الفحص الافتراضية لكل مؤسسة (آمن لإعادة التشغيل، لا يكرّر البنود).
// آمن لإعادة التشغيل بالكامل.
// الاستخدام: node --env-file-if-exists=/vercel/share/.env.project scripts/020-equipment-daily-checks.mjs
import { Client } from "pg"
import crypto from "node:crypto"

// بنود قائمة الفحص الافتراضية. powerScope: common (لكل المعدات) | electric | diesel.
// isSafetyCritical=true تعني أن العيب فيها يُخرج المعدة من الخدمة تلقائياً.
const DEFAULT_ITEMS = [
  // ---- بنود مشتركة ----
  { itemCode: "tyres", labelAr: "الإطارات والعجلات", labelEn: "Tyres & wheels", powerScope: "common", critical: true },
  { itemCode: "forks", labelAr: "الشوكات ومسند الحمل الخلفي", labelEn: "Forks & load backrest", powerScope: "common", critical: true },
  { itemCode: "mast", labelAr: "الصاري وسلاسل الرفع والبكرات والمصدّات", labelEn: "Mast, lift chains, rollers & stops", powerScope: "common", critical: true },
  { itemCode: "overhead_guard", labelAr: "واقي الرأس والهيكل", labelEn: "Overhead guard & frame", powerScope: "common", critical: true },
  { itemCode: "hydraulics", labelAr: "الخراطيم والأسطوانات الهيدروليكية (بلا تسريب)", labelEn: "Hydraulic hoses & cylinders (no leaks)", powerScope: "common", critical: true },
  { itemCode: "brakes", labelAr: "فرامل التشغيل والانتظار", labelEn: "Service & parking brakes", powerScope: "common", critical: true },
  { itemCode: "steering", labelAr: "نظام التوجيه", labelEn: "Steering", powerScope: "common", critical: true },
  { itemCode: "horn_alarm", labelAr: "البوق وإنذار الرجوع والمنارة الدوّارة", labelEn: "Horn, reverse alarm & beacon", powerScope: "common", critical: true },
  { itemCode: "lights_mirrors", labelAr: "الأضواء والمرايا", labelEn: "Lights & mirrors", powerScope: "common", critical: false },
  { itemCode: "gauges_estop", labelAr: "العدّادات وأدوات التحكم وزر التوقف الطارئ", labelEn: "Gauges, controls & emergency stop", powerScope: "common", critical: true },
  { itemCode: "seat_belt", labelAr: "حزام الأمان والمقعد", labelEn: "Seat belt & seat", powerScope: "common", critical: true },
  { itemCode: "fire_ext", labelAr: "طفاية الحريق موجودة ومشحونة", labelEn: "Fire extinguisher present & charged", powerScope: "common", critical: false },
  { itemCode: "data_plate", labelAr: "لوحة البيانات واضحة ومقروءة", labelEn: "Data plate legible", powerScope: "common", critical: false },
  { itemCode: "lift_tilt", labelAr: "الرفع والخفض والإمالة تعمل بسلاسة", labelEn: "Lift / lower / tilt operate smoothly", powerScope: "common", critical: true },
  // ---- بنود الكهربائية (ليثيوم) فقط ----
  { itemCode: "battery_charge", labelAr: "مستوى شحن البطارية", labelEn: "Battery charge level", powerScope: "electric", critical: false },
  { itemCode: "battery_connector", labelAr: "حالة موصّل وكابل البطارية", labelEn: "Battery connector & cable condition", powerScope: "electric", critical: true },
  { itemCode: "bms_alarms", labelAr: "إنذارات نظام إدارة البطارية (BMS)", labelEn: "BMS / battery warning alarms", powerScope: "electric", critical: false },
  // ---- بنود الديزل فقط ----
  { itemCode: "fuel_level", labelAr: "مستوى الوقود وعدم التسريب", labelEn: "Fuel level & no leaks", powerScope: "diesel", critical: true },
  { itemCode: "engine_fluids", labelAr: "مستويات زيت المحرك وسائل التبريد", labelEn: "Engine oil & coolant levels", powerScope: "diesel", critical: false },
]

const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

async function addColumn(table, ddl) {
  await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS ${ddl}`)
}

async function run() {
  await client.query("BEGIN")
  try {
    // ---------- توسيع equipment ----------
    await addColumn("equipment", `"power_type" text NOT NULL DEFAULT 'diesel'`)
    await addColumn("equipment", `"qr_token" text NOT NULL DEFAULT ''`)

    // بذر رمز QR فريد لكل معدة بدون رمز بعد.
    const noToken = await client.query(`SELECT id FROM equipment WHERE qr_token = '' OR qr_token IS NULL`)
    for (const row of noToken.rows) {
      const token = `eq_${crypto.randomBytes(9).toString("hex")}`
      await client.query(`UPDATE equipment SET qr_token = $1 WHERE id = $2`, [token, row.id])
    }
    // فهرس فريد لرمز QR (بعد البذر لتفادي تعارض القيم الفارغة المتكررة).
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "equipment_qr_token_idx" ON "equipment" ("qr_token")`)

    // ---------- equipment_checklist_item ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS "equipment_checklist_item" (
        "id" serial PRIMARY KEY,
        "organizationId" text NOT NULL,
        "item_code" text NOT NULL,
        "label_ar" text NOT NULL DEFAULT '',
        "label_en" text NOT NULL DEFAULT '',
        "power_scope" text NOT NULL DEFAULT 'common',
        "is_safety_critical" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS "equipment_checklist_item_org_idx" ON "equipment_checklist_item" ("organizationId")`)
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "equipment_checklist_item_org_code_idx" ON "equipment_checklist_item" ("organizationId","item_code")`)

    // ---------- equipment_daily_check ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS "equipment_daily_check" (
        "id" serial PRIMARY KEY,
        "code" text NOT NULL DEFAULT '',
        "userId" text NOT NULL,
        "organizationId" text NOT NULL,
        "equipment_id" integer NOT NULL,
        "operator_employee_id" integer,
        "operator_name" text NOT NULL DEFAULT '',
        "shift" text NOT NULL DEFAULT '1',
        "check_date" date NOT NULL,
        "hour_meter" integer,
        "power_type" text NOT NULL DEFAULT 'diesel',
        "result" text NOT NULL DEFAULT 'fit',
        "entry_method" text NOT NULL DEFAULT 'qr',
        "permit_status" text NOT NULL DEFAULT 'valid',
        "matched_permit_id" integer,
        "operator_signature_url" text NOT NULL DEFAULT '',
        "supervisor_id" text,
        "supervisor_name" text NOT NULL DEFAULT '',
        "supervisor_signature_url" text NOT NULL DEFAULT '',
        "supervisor_signed_at" timestamp,
        "maintenance_ticket_id" integer,
        "corrective_action_id" integer,
        "location" text NOT NULL DEFAULT '',
        "notes" text NOT NULL DEFAULT '',
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS "equipment_daily_check_org_date_idx" ON "equipment_daily_check" ("organizationId","check_date")`)
    await client.query(`CREATE INDEX IF NOT EXISTS "equipment_daily_check_eq_idx" ON "equipment_daily_check" ("organizationId","equipment_id")`)

    // ---------- equipment_daily_check_item ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS "equipment_daily_check_item" (
        "id" serial PRIMARY KEY,
        "check_id" integer NOT NULL,
        "organizationId" text NOT NULL,
        "item_code" text NOT NULL,
        "label_ar" text NOT NULL DEFAULT '',
        "status" text NOT NULL DEFAULT 'ok',
        "is_safety_critical" boolean NOT NULL DEFAULT false,
        "note" text NOT NULL DEFAULT '',
        "photo_url" text NOT NULL DEFAULT ''
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS "equipment_daily_check_item_check_idx" ON "equipment_daily_check_item" ("check_id")`)

    // ---------- maintenance_ticket ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS "maintenance_ticket" (
        "id" serial PRIMARY KEY,
        "code" text NOT NULL DEFAULT '',
        "userId" text NOT NULL,
        "organizationId" text NOT NULL,
        "equipment_id" integer NOT NULL,
        "source_check_id" integer,
        "title" text NOT NULL DEFAULT '',
        "description" text NOT NULL DEFAULT '',
        "priority" text NOT NULL DEFAULT 'high',
        "status" text NOT NULL DEFAULT 'open',
        "opened_by" text NOT NULL DEFAULT '',
        "closed_by" text NOT NULL DEFAULT '',
        "closed_at" timestamp,
        "closure_note" text NOT NULL DEFAULT '',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS "maintenance_ticket_org_status_idx" ON "maintenance_ticket" ("organizationId","status")`)
    await client.query(`CREATE INDEX IF NOT EXISTS "maintenance_ticket_eq_idx" ON "maintenance_ticket" ("organizationId","equipment_id")`)

    // ---------- بذر بنود الفحص الافتراضية لكل مؤسسة ----------
    const orgs = await client.query(`SELECT id FROM organization`)
    let seededOrgs = 0
    for (const org of orgs.rows) {
      let inserted = 0
      for (let i = 0; i < DEFAULT_ITEMS.length; i++) {
        const it = DEFAULT_ITEMS[i]
        const res = await client.query(
          `INSERT INTO "equipment_checklist_item"
             ("organizationId","item_code","label_ar","label_en","power_scope","is_safety_critical","sort_order","active")
           VALUES ($1,$2,$3,$4,$5,$6,$7,true)
           ON CONFLICT ("organizationId","item_code") DO NOTHING`,
          [org.id, it.itemCode, it.labelAr, it.labelEn, it.powerScope, it.critical, (i + 1) * 10],
        )
        inserted += res.rowCount || 0
      }
      if (inserted > 0) seededOrgs++
    }

    await client.query("COMMIT")

    // ---------- تحقق ----------
    const counts = await client.query(`
      SELECT
        (SELECT count(*) FROM equipment WHERE qr_token <> '') AS equipment_with_token,
        (SELECT count(*) FROM equipment_checklist_item) AS checklist_items,
        (SELECT count(DISTINCT "organizationId") FROM equipment_checklist_item) AS orgs_with_items
    `)
    console.log("[020] تم الترحيل بنجاح.")
    console.log("[020] عدد المؤسسات التي بُذرت لها بنود:", seededOrgs)
    console.log("[020] التحقق:", counts.rows[0])
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    await client.end()
  }
}

run().catch((e) => {
  console.error("[020] فشل الترحيل:", e)
  process.exit(1)
})
