import { requireAdmin } from "@/lib/session"
import { getUsers } from "@/app/actions/users"
import { AppShell } from "@/components/app-shell"
import { UsersManager } from "@/components/users-manager"

export default async function UsersPage() {
  const admin = await requireAdmin()
  const users = await getUsers()

  return (
    <AppShell
      title="إدارة المستخدمين"
      subtitle="الموافقة على المستخدمين الجدد وتحديد أدوارهم وصلاحياتهم"
      user={admin}
    >
      <UsersManager users={users} currentUserId={admin.id} />
    </AppShell>
  )
}
