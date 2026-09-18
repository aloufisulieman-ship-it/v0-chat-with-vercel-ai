// 018 — عمود camera_rules على safety_rules (schema فقط، بلا بيانات).
// يفصل القواعد القابلة للرصد بكاميرا مراقبة سلوك ظاهر في إطار واحد (PPE، مسافات،
// سرعة، وضعية معدة، دخان...) عن rules الكامل الذي يبقى للعرض في صفحة
// /safety-rules دون تغيير. راجع lib/db/schema.ts (safetyRule.cameraRules) و
// app/actions/ai-recognition.ts (getSafetyRulesForLocation يفضّل هذا العمود على
// rules عند تغذية نموذج الرؤية الحاسوبية، مع رجوع لـ rules كاملاً لأي سجل لم
// يُصنَّف بعد — توافق خلفي).
//
// يجب أن يُشغَّل قبل scripts/017-seed-safety-rules-mhs.mjs (أو نسخته .sql):
// الأخيران يُدرجان قيمة camera_rules مباشرة فيُخطئان إن لم يوجد العمود. مع ذلك
// يحمل 017 نفس سطر ALTER TABLE ... IF NOT EXISTS دفاعياً بداخله أيضاً، فتبقى
// إعادة تشغيل 017 بمفرده آمنة حتى لو نُسي تشغيل 018 أولاً — هذا السكربت هو
// المرجع القياسي المستقل لإضافة العمود لمن يفضّل خطوة schema منفصلة عن البذر.
//
// إضافة فقط — لا حذف ولا فقدان بيانات، وقابل لإعادة التشغيل بأمان.
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const c = await pool.connect()
  try {
    await c.query("begin")
    await c.query(`alter table safety_rules add column if not exists camera_rules text not null default ''`)
    await c.query("commit")
    console.log(`018 done — camera_rules column present on safety_rules`)
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
