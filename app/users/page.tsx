import { requireAdmin } from "@/lib/session"
import { getUsers } from "@/app/actions/users"
import { AppShell } from "@/components/app-shell"
import { UsersManager } from "@/components/users-manager"
import { getServerT } from "@/lib/i18n/server"

export default async function UsersPage() {
  const admin = await requireAdmin()
  const users = await getUsers()
  const { t } = await getServerT()

  return (
    <AppShell
      title={t("pageHeaders.usersTitle")}
      subtitle={t("pageHeaders.usersSubtitle")}
      user={admin}
    >
      <UsersManager users={users} currentUserId={admin.id} />
    </AppShell>
  )
}
