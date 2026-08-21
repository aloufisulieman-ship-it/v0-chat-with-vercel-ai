import { cache } from "react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { hasModuleAccess, type ModuleKey } from "@/lib/permissions"

export type AppUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
  department: string
  permissions: string
  locale: string
}

const userColumns = {
  id: userTable.id,
  name: userTable.name,
  email: userTable.email,
  role: userTable.role,
  status: userTable.status,
  department: userTable.department,
  permissions: userTable.permissions,
  locale: userTable.locale,
}

// Resolves the current session + user row in ONE database round trip, memoized
// for the lifetime of a single request via React cache(). RootLayout and the
// page both need the user, and without this each helper would re-run the
// Better Auth session query plus the user lookup, doubling DB data transfer on
// every navigation. cache() collapses those duplicate calls into one.
const loadSessionUser = cache(async (): Promise<AppUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const rows = await db.select(userColumns).from(userTable).where(eq(userTable.id, session.user.id)).limit(1)
  return rows[0] ?? null
})

// Returns the authenticated user with role/status, or redirects to sign-in.
export async function requireUser(): Promise<AppUser> {
  const u = await loadSessionUser()
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

// مسؤول HSE / المراجع: صاحب دور admin أو manager.
// صفحات المراجعة (اللوحة، البث المباشر، التسجيلات) حصرية لهذه الفئة.
export function isHseReviewer(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager"
}

// حارس صفحات المراجعة: يعيد المستخدم إن كان مراجعاً، وإلا يوجّهه لصفحة عدم التصريح.
export async function requireHseReviewer(): Promise<AppUser> {
  const u = await requireUser()
  if (!isHseReviewer(u.role)) redirect("/ai-monitoring/unauthorized")
  return u
}

// نسخة لاستخدامها داخل server actions: ترمي خطأً بدل التوجيه.
export async function requireHseReviewerId(): Promise<string> {
  const u = await requireUser()
  if (!isHseReviewer(u.role)) {
    throw new Error("هذه العملية مقصورة على مسؤول HSE (مدير أو أدمن)")
  }
  return u.id
}

// Requires the user to have access to a given module, else sends them home.
export async function requireModule(module: ModuleKey): Promise<AppUser> {
  const u = await requireUser()
  if (!hasModuleAccess(u.role, u.permissions, module)) redirect("/")
  return u
}

// Throws when the user cannot access a module. Use inside server actions.
export async function requireModuleUserId(module: ModuleKey): Promise<string> {
  const u = await requireUser()
  if (!hasModuleAccess(u.role, u.permissions, module)) {
    throw new Error("ليس لديك صلاحية للوصول إلى هذا القسم")
  }
  return u.id
}

// Returns the user without enforcing approval (for the /pending page itself).
export async function getCurrentUser(): Promise<AppUser | null> {
  return loadSessionUser()
}
