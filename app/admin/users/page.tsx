import { requireAdmin } from "@/lib/session"
import { getUserAuditLog, listAdminUsers } from "@/app/actions/admin-users"
import { AppShell } from "@/components/app-shell"
import { AdminUsersManager } from "@/components/admin-users/admin-users-manager"
import { getServerT } from "@/lib/i18n/server"

// إدارة المستخدمين المتقدّمة (مدير المؤسسة): الأدوار، حالة الحساب، كلمات المرور، الجلسات،
// وسجل التدقيق. تعيش داخل AppShell العادي (وليس تخطيط مسؤول المنصّة في (platform)).
export default async function AdminUsersPage() {
  const admin = await requireAdmin()
  const [users, audit] = await Promise.all([listAdminUsers(), getUserAuditLog(150)])
  const { locale } = await getServerT()
  const loc = locale === "en" ? "en" : "ar"

  return (
    <AppShell
      title={loc === "en" ? "User administration" : "إدارة المستخدمين"}
      subtitle={
        loc === "en"
          ? "Roles, account status, passwords, sessions and the change audit log"
          : "الأدوار وحالة الحساب وكلمات المرور والجلسات وسجل التدقيق"
      }
      user={admin}
    >
      <AdminUsersManager users={users} audit={audit} currentUserId={admin.id} locale={loc} />
    </AppShell>
  )
}
