import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { appNotification } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { hasModuleAccess } from "@/lib/permissions"
import { getUnreadAiNotifications, markAiNotificationsRead } from "@/app/actions/ai-monitoring"
import type { Dept } from "@/lib/lifecycle"

// إشعارات موحّدة للجرس في الهيدر: تنبيهات الرصد الآلي + إحالات دورة الحياة غير المقروءة
// للجهات التي يملك المستخدم صلاحية الوصول إليها (hr / finance).
function visibleDepts(u: { role: string; permissions: string }): Dept[] {
  return (["hr", "finance"] as Dept[]).filter((d) => hasModuleAccess(u.role, u.permissions, d))
}

export async function GET() {
  try {
    const u = await getCurrentUser()
    if (!u) return Response.json({ count: 0, notifications: [] })

    const depts = visibleDepts(u)
    const [ai, referrals] = await Promise.all([
      hasModuleAccess(u.role, u.permissions, "ai_monitoring") ? getUnreadAiNotifications().catch(() => []) : [],
      depts.length
        ? db
            .select()
            .from(appNotification)
            .where(and(eq(appNotification.organizationId, u.organizationId), eq(appNotification.read, false)))
            .orderBy(desc(appNotification.createdAt))
            .limit(50)
            .then((rows) => rows.filter((r) => depts.includes(r.targetModule as Dept)))
        : [],
    ])

    const notifications = [
      ...ai.map((n) => ({ kind: "ai" as const, message: n.message, href: "/ai-monitoring" })),
      ...referrals.map((n) => ({
        kind: "referral" as const,
        message: `${n.title}: ${n.message}`,
        href: n.targetModule === "hr" ? "/hr" : "/finance",
      })),
    ]
    return Response.json({ count: notifications.length, notifications })
  } catch {
    return Response.json({ count: 0, notifications: [] })
  }
}

export async function POST() {
  const u = await getCurrentUser()
  if (!u) return Response.json({ ok: false }, { status: 401 })
  const depts = visibleDepts(u)
  await Promise.all([
    hasModuleAccess(u.role, u.permissions, "ai_monitoring") ? markAiNotificationsRead().catch(() => null) : null,
    ...depts.map((d) =>
      db
        .update(appNotification)
        .set({ read: true })
        .where(and(eq(appNotification.organizationId, u.organizationId), eq(appNotification.targetModule, d))),
    ),
  ])
  return Response.json({ ok: true })
}
