// 019 — عمود sort_order على safety_rules (ترتيب عرض المواقع في /safety-rules)
// + ضبط قيمه لمواقع منشأة "شركة الأيادي الفضية الحديثة" (MHS) التسعة الحالية.
//
// يضيف العمود (IF NOT EXISTS، آمن لإعادة التشغيل) بقيمة افتراضية 0 لأي سجل غير
// مُرتَّب، ثم يضبط قيمه لصفوف المواقع التسعة التي بذرها scripts/017 بالترتيب
// التالي (المطلوب من المستخدم):
//   1. الساحة — التحميل والتفريغ (العمال)
//   2. الساحة — مسارات الرافعات الشوكية
//   3. الساحة — مواقف الشاحنات (الزوار)
//   4. الورشة — منطقة الإصلاح
//   5. الورشة — منطقة الشحن الكهربائي (الرافعات والتوكتوك)
//   6. الورشة — فنيو الورشة
//   7. مخزن قطع الغيار ومكتب الورشة
//   8. مكتب السلامة والعمليات ومكاتب الإدارة التنفيذية (مبنى الورشة)
//   9. المكتب الرئيسي
//
// نطاق التشغيل: نفس منطق 017 — مؤسسة واحدة محدَّدة بالاسم (ILIKE على
// organization.name أو company.name)، يتوقف بخطأ واضح إن لم يجد مطابقة واحدة
// حصراً. لا يلمس أي صف بموقع خارج القائمة أعلاه أو بمؤسسة أخرى.
//
// getSafetyRules (app/actions/equipment.ts) لا تحمل أي اسم موقع مكتوباً بداخلها؛
// هذا السكربت هو المكان الوحيد الذي يربط الأسماء بالأرقام (توافقاً مع طلب عدم
// تكرار أسماء المواقع في كود الاستعلام الدائم).
//
// إعادة التشغيل آمنة ومثالية (idempotent): يضبط نفس القيم في كل مرة.
//
// الاستخدام:
//   node scripts/019-safety-rules-sort-order.mjs --dry   يعرض فقط: المؤسسة
//                                                         المُحلَّاة، والقيم
//                                                         الحالية والمخطَّطة
//                                                         لكل موقع — بلا أي
//                                                         تعديل.
//   node scripts/019-safety-rules-sort-order.mjs         ينفّذ الترحيل فعلياً.
import { Pool } from "pg"

const DRY = process.argv.includes("--dry")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const ORG_NAME_PATTERN = "%الأيادي الفضية الحديثة%"

const SORT_ORDER = [
  ["الساحة — التحميل والتفريغ (العمال)", 1],
  ["الساحة — مسارات الرافعات الشوكية", 2],
  ["الساحة — مواقف الشاحنات (الزوار)", 3],
  ["الورشة — منطقة الإصلاح", 4],
  ["الورشة — منطقة الشحن الكهربائي (الرافعات والتوكتوك)", 5],
  ["الورشة — فنيو الورشة", 6],
  ["مخزن قطع الغيار ومكتب الورشة", 7],
  ["مكتب السلامة والعمليات ومكاتب الإدارة التنفيذية (مبنى الورشة)", 8],
  ["المكتب الرئيسي", 9],
]

async function resolveOrg(c) {
  const { rows } = await c.query(
    `select distinct o.id as org_id, o.name as org_name
       from organization o
       left join company c on c."organizationId" = o.id
      where o.name ilike $1 or c.name ilike $1`,
    [ORG_NAME_PATTERN],
  )
  if (rows.length === 0) {
    throw new Error(`لم توجد أي مؤسسة تطابق "${ORG_NAME_PATTERN}" — لم يُعدَّل شيء.`)
  }
  if (rows.length > 1) {
    throw new Error(
      `وُجدت أكثر من مؤسسة مطابقة (${rows.map((r) => `${r.org_name} [${r.org_id}]`).join("، ")}) — ` +
        `حدّد المؤسسة يدوياً قبل المتابعة، لم يُعدَّل شيء.`,
    )
  }
  return rows[0]
}

async function main() {
  const c = await pool.connect()
  try {
    const org = await resolveOrg(c)

    await c.query(`alter table safety_rules add column if not exists sort_order integer not null default 0`)

    const locations = SORT_ORDER.map(([location]) => location)
    const { rows: current } = await c.query(
      `select location, sort_order from safety_rules where "organizationId" = $1 and location = any($2::text[])`,
      [org.org_id, locations],
    )
    const currentByLocation = Object.fromEntries(current.map((r) => [r.location, r.sort_order]))

    if (DRY) {
      console.log(`019 --dry — أُضيف العمود إن لم يكن موجوداً؛ لم تُعدَّل أي قيمة.`)
      console.log(`المؤسسة: ${org.org_name}  [${org.org_id}]`)
      console.table(
        SORT_ORDER.map(([location, sortOrder]) => ({
          الموقع: location,
          "sort_order الحالي": location in currentByLocation ? currentByLocation[location] : "(لا يوجد سجل)",
          "sort_order المخطَّط": sortOrder,
        })),
      )
      return
    }

    await c.query("begin")
    for (const [location, sortOrder] of SORT_ORDER) {
      await c.query(
        `update safety_rules set sort_order = $1, "updatedAt" = now() where "organizationId" = $2 and location = $3`,
        [sortOrder, org.org_id, location],
      )
    }
    await c.query("commit")
    console.log(`019 done — sort_order مضبوط لـ ${SORT_ORDER.length} موقع(اً) في "${org.org_name}" [${org.org_id}]`)
  } catch (e) {
    if (!DRY) await c.query("rollback")
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
