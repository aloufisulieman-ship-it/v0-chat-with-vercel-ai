import { betterAuth } from "better-auth"
import { APIError } from "better-auth/api"
import { pool } from "@/lib/db"

// رسائل الحجب (تُعرض في نموذج تسجيل الدخول كما هي).
export const ACCOUNT_BLOCKED_MESSAGES: Record<string, string> = {
  suspended: "حسابك موقوف مؤقتاً. يرجى التواصل مع مسؤول النظام.",
  banned: "تم حظر هذا الحساب نهائياً.",
}

function clientIp(h: Headers | undefined) {
  if (!h) return ""
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || ""
}

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "pending",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          // نموذج متعدد المؤسسات: التسجيل العام يمرّ عبر registerOrganization الذي
          // ينشئ المؤسسة ويرقّي المُسجِّل إلى admin/approved بعد الإنشاء. هنا نضبط
          // الحد الأدنى الآمن فقط (عضو غير مُفعّل) لأي مسار إنشاء غير متوقّع.
          return {
            data: {
              ...newUser,
              role: "user",
              status: "pending",
            },
          }
        },
      },
    },
    session: {
      create: {
        // بوابة الدخول على مستوى الخادم: أي حساب suspended/banned يُرفض إنشاء جلسة له
        // حتى مع كلمة مرور صحيحة (لا يمكن تجاوزها من الواجهة). عند النجاح نسجّل آخر دخول.
        before: async (session, ctx) => {
          const { rows } = await pool.query<{ account_status: string }>(
            `select account_status from "user" where id = $1 limit 1`,
            [session.userId],
          )
          const st = rows[0]?.account_status ?? "active"
          if (st === "suspended" || st === "banned") {
            throw new APIError("FORBIDDEN", { message: ACCOUNT_BLOCKED_MESSAGES[st], code: `ACCOUNT_${st.toUpperCase()}` })
          }
          const h = ctx?.headers ?? ctx?.request?.headers
          await pool.query(
            `update "user" set last_login_at = now(), last_login_ip = $2, last_login_device = $3 where id = $1`,
            [session.userId, clientIp(h), (h?.get("user-agent") ?? "").slice(0, 300)],
          )
          return { data: session }
        },
      },
    },
  },
  trustedOrigins: [
    "http://localhost:3000",
    // v0 preview environments are served from rotating *.vusercontent.net
    // subdomains that don't always match V0_RUNTIME_URL, so trust them all.
    "https://*.vusercontent.net",
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        },
      }
    : {}),
})
