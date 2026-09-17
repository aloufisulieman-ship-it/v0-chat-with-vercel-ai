// 015 — أثر تغيير حالة التدقيق: من غيّر الحالة ومتى.
// يضيف عمودَي status_changed_by و status_changed_at إلى جدول audit، ويهيّئ
// السجلات القائمة التي حالتها ليست "مجدول" بقيمة افتراضية تشير إلى ما قبل التتبّع.
// إضافة/تهيئة فقط — لا حذف ولا فقدان بيانات.
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const c = await pool.connect()
  try {
    await c.query("begin")

    await c.query(`alter table audit add column if not exists status_changed_by text not null default ''`)
    await c.query(`alter table audit add column if not exists status_changed_at timestamp`)

    // السجلات التي تغيّرت حالتها قبل وجود التتبّع: نوثّق أن المصدر غير معروف بدل
    // ترك الحقل فارغاً فيبدو كأن الحالة لم تتغيّر قط.
    const seeded = await c.query(`
      update audit
         set status_changed_by = 'غير مسجَّل (قبل تفعيل التتبّع)',
             status_changed_at = "createdAt"
       where coalesce(status, 'scheduled') <> 'scheduled'
         and status_changed_at is null`)

    await c.query("commit")
    console.log(`015 done — seeded ${seeded.rowCount ?? 0} existing audit rows`)
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
