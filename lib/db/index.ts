import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// نستخدم كائن Pool واحداً معاد الاستخدام عبر استدعاءات الدوال بلا خادم (serverless).
// على Vercel تُجمَّد نُسخ الدالة بين الطلبات، وتغلق Neon الاتصالات الخاملة؛ فإذا
// أطلق node-postgres حدث "error" على عميل خامل دون وجود مستمع له، فإن Node يرمي
// استثناءً غير مُلتقط يُسقط عملية الدالة بالكامل (يظهر كـ "A server error occurred").
// لذا نُنشئ الـ Pool مرة واحدة، ونضيف مستمع أخطاء، ونضبط إعدادات مناسبة لـ serverless.

// نحتفظ بالـ Pool على globalThis حتى لا يُعاد إنشاؤه مع كل إعادة تحميل للوحدة
// (HMR في التطوير، أو إعادة استخدام النسخة الدافئة في الإنتاج).
const globalForDb = globalThis as unknown as { __hsePgPool?: Pool }

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // عدد اتصالات معتدل يناسب النموذج بلا خادم دون استنزاف حدود Neon عبر النسخ.
    max: 5,
    // أغلق الاتصالات الخاملة بسرعة لتفادي بقاء اتصالات ميتة بعد تجميد النسخة.
    idleTimeoutMillis: 10_000,
    // لا تنتظر طويلاً عند تعذّر الاتصال؛ يفشل الطلب بوضوح بدل التعليق.
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  })

  // مستمع الأخطاء الحيوي: يمنع أن يُسقط خطأٌ على عميل خامل عمليةَ الدالة بالكامل.
  pool.on("error", (err) => {
    console.log("[v0] pg pool idle client error (handled):", err.message)
  })

  return pool
}

export const pool = globalForDb.__hsePgPool ?? createPool()
globalForDb.__hsePgPool = pool

export const db = drizzle(pool, { schema })
