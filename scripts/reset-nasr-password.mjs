// سكربت لمرة واحدة: إعادة تعيين كلمة مرور المستخدم نصر (hse@mhsom.com)
// يستخدم دالة الهاش الافتراضية في Better Auth (scrypt) مباشرة من الحزمة
// لضمان توافق الهاش تماماً مع مسار الدخول، دون استيراد ملفات التطبيق (المسار @/).
import { hashPassword, verifyPassword } from "better-auth/crypto"
import pg from "pg"

const EMAIL = "hse@mhsom.com"
const NEW_PASSWORD = process.env.NEW_PASSWORD || "Nasr@2026#Reset"

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!connectionString) {
  console.error("[reset] لا يوجد DATABASE_URL في البيئة")
  process.exit(1)
}

const pool = new pg.Pool({ connectionString })

try {
  const { rows: users } = await pool.query('select id, name, email from "user" where email = $1 limit 1', [EMAIL])
  const u = users[0]
  if (!u) {
    console.error(`[reset] لا يوجد مستخدم بالبريد ${EMAIL}`)
    process.exit(1)
  }

  const hash = await hashPassword(NEW_PASSWORD)

  const { rows: updated } = await pool.query(
    `update "account" set password = $1, "updatedAt" = now()
     where "userId" = $2 and "providerId" = 'credential' returning id`,
    [hash, u.id],
  )
  if (!updated[0]) {
    console.error("[reset] لا يوجد حساب بكلمة مرور (credential) لهذا المستخدم")
    process.exit(1)
  }

  // تحقّق أن الهاش الجديد يُتحقّق منه بنفس آلية Better Auth قبل إنهاء الجلسات.
  const ok = await verifyPassword({ hash, password: NEW_PASSWORD })
  if (!ok) {
    console.error("[reset] فشل التحقق من الهاش الجديد — لم تُنهَ الجلسات")
    process.exit(1)
  }

  // إنهاء الجلسات القائمة حتى تُعتمد كلمة المرور الجديدة حصراً.
  await pool.query('delete from "session" where "userId" = $1', [u.id])

  console.log(`[reset] تمت إعادة تعيين كلمة مرور ${u.name || EMAIL} بنجاح، وأُنهيت جلساته.`)
  console.log(`[reset] كلمة المرور المؤقتة: ${NEW_PASSWORD}`)
} finally {
  await pool.end()
}
