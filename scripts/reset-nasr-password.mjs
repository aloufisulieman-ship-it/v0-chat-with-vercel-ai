// سكربت لمرة واحدة: إعادة تعيين كلمة مرور المستخدم نصر (hse@mhsom.com)
// يستخدم سياق Better Auth لضمان توافق الهاش تماماً مع مسار الدخول.
import { auth } from "../lib/auth.ts"
import { db } from "../lib/db/index.ts"
import { account as accountTable, session as sessionTable, user as userTable } from "../lib/db/schema.ts"
import { and, eq } from "drizzle-orm"

const EMAIL = "hse@mhsom.com"
const NEW_PASSWORD = process.env.NEW_PASSWORD || "Nasr@2026#Reset"

const [u] = await db.select().from(userTable).where(eq(userTable.email, EMAIL)).limit(1)
if (!u) {
  console.error(`[reset] لا يوجد مستخدم بالبريد ${EMAIL}`)
  process.exit(1)
}

const ctx = await auth.$context
const hash = await ctx.password.hash(NEW_PASSWORD)

const updated = await db
  .update(accountTable)
  .set({ password: hash, updatedAt: new Date() })
  .where(and(eq(accountTable.userId, u.id), eq(accountTable.providerId, "credential")))
  .returning({ id: accountTable.id })

if (!updated[0]) {
  console.error("[reset] لا يوجد حساب بكلمة مرور (credential) لهذا المستخدم")
  process.exit(1)
}

// إنهاء الجلسات القائمة.
await db.delete(sessionTable).where(eq(sessionTable.userId, u.id))

console.log(`[reset] تمت إعادة تعيين كلمة مرور ${u.name || EMAIL} بنجاح.`)
console.log(`[reset] كلمة المرور المؤقتة: ${NEW_PASSWORD}`)
process.exit(0)
