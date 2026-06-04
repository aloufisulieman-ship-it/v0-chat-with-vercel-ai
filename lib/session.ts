import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { canEdit, canView, type SectionKey } from "@/lib/permissions"

export type AppUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
  permissions: string
}

const userColumns = {
  id: userTable.id,
  name: userTable.name,
  email: userTable.email,
  role: userTable.role,
  status: userTable.status,
  permissions: userTable.permissions,
}

// Returns the authenticated user with role/status, or redirects to sign-in.
export async function requireUser(): Promise<AppUser> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const rows = await db.select(userColumns).from(userTable).where(eq(userTable.id, session.user.id)).limit(1)

  const u = rows[0]
  if (!u) redirect("/sign-in")

  // Users awaiting approval are sent to a holding page.
  if (u.status !== "approved") redirect("/pending")

  return u
}

// Same as requireUser but also enforces admin role.
export async function requireAdmin(): Promise<AppUser> {
  const u = await requireUser()
  if (u.role !== "admin") redirect("/")
  return u
}

// Requires the user to be able to VIEW a given section, else sends them home.
export async function requireView(section: SectionKey): Promise<AppUser> {
  const u = await requireUser()
  if (!canView(u.role, u.permissions, section)) redirect("/")
  return u
}

// Throws when the user cannot EDIT a section. Use inside server actions.
export async function requireEditUserId(section: SectionKey): Promise<string> {
  const u = await requireUser()
  if (!canEdit(u.role, u.permissions, section)) {
    throw new Error("ليس لديك صلاحية التعديل في هذا القسم")
  }
  return u.id
}

// Returns the user without enforcing approval (for the /pending page itself).
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const rows = await db.select(userColumns).from(userTable).where(eq(userTable.id, session.user.id)).limit(1)
  return rows[0] ?? null
}
