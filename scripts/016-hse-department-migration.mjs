// 016 — ترحيل حسابات مدير السلامة والصحة المهنية إلى القسم الإداري الجديد "hse".
//
// حتى الآن لم يكن للنظام قسم إداري مستقل لمدير السلامة والصحة المهنية، فكان
// من يشغل هذا الدور يُسجَّل تحت قسم "مفتش السلامة" — وهو مسمّى وظيفي (مفتش
// ميداني) لا قسم إداري، ما كان يخلط بين المفتش الميداني ومدير السلامة الفعلي
// في أي قرار يعتمد القسم (مثل تغيير حالة التدقيق في app/actions/hse.ts).
//
// هذا السكربت ينقل فقط حسابات role = 'manager' (لا role = 'user'، فهؤلاء
// غالباً مفتشون ميدانيون فعليون لا مدراء) التي قسمها كان يشير إلى قسم السلامة،
// إلى القسم الجديد "hse". يُعالَج التمثيلان المحتملان للقيمة القديمة معاً:
//   - "inspector": القيمة (slug) التي يكتبها اختيار القسم في واجهة إدارة
//     المستخدمين الحالية (components/users-manager.tsx).
//   - "مفتش السلامة": نص عربي حرفي، وهو ما تتوقعه استعلامات قديمة أخرى في
//     المستودع (مثل scripts/backfill-corrective-actions.sql) — فقد تكون بعض
//     الحسابات محفوظة بهذا الشكل من مسار كتابة سابق أو تعديل مباشر لقاعدة البيانات.
// إضافة/تحديث فقط — لا حذف ولا فقدان بيانات، وقابل لإعادة التشغيل بأمان.
//
// الاستخدام:
//   node scripts/016-hse-department-migration.mjs --dry   يعرض الحسابات المرشّحة
//                                                          للنقل (الاسم، الدور،
//                                                          القسم الحالي) دون أي
//                                                          تعديل — لا معاملة (transaction)
//                                                          كتابية تُفتح إطلاقاً في وضع dry-run.
//   node scripts/016-hse-department-migration.mjs         ينفّذ النقل فعلياً.
import { Pool } from "pg"

const DRY = process.argv.includes("--dry")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// نفس شرط الترشّح تماماً بين وضعَي العرض والتنفيذ — سطر واحد لا نسختان قد تنحرفان.
const CANDIDATE_WHERE = `role = 'manager' and department in ('inspector', 'مفتش السلامة')`

async function main() {
  const c = await pool.connect()
  try {
    if (DRY) {
      const { rows } = await c.query(`
        select id, name, email, role, department, "organizationId"
          from "user"
         where ${CANDIDATE_WHERE}
         order by "organizationId", name`)
      console.log(`016 --dry — ${rows.length} حساباً مرشّحاً للنقل إلى القسم "hse" (لم يُعدَّل شيء):`)
      console.table(
        rows.map((r) => ({
          الاسم: r.name,
          البريد: r.email,
          الدور: r.role,
          "القسم الحالي": r.department,
          المؤسسة: r.organizationId,
        })),
      )
      return
    }

    await c.query("begin")
    const migrated = await c.query(`update "user" set department = 'hse' where ${CANDIDATE_WHERE}`)
    await c.query("commit")
    console.log(`016 done — migrated ${migrated.rowCount ?? 0} manager account(s) to the "hse" department`)
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
