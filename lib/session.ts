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
  // المؤسسة (المستأجر) التي ينتمي إليها المستخدم — الحدّ الأعلى للعزل.
  organizationId: string
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
  organizationId: userTable.organizationId,
}

// نطاق الوصول الموحّد لكل server action: هوية المستخدم + مؤسسته + هل هو مدير داخل
// مؤسسته. تُبنى كل الاستعلامات فوق هذا الكائن: العزل بين المؤسسات صارم (organizationId
// دائماً)، وداخل المؤسسة يرى المديرُ كل السجلات والموظفُ سجلاته فقط.
export type ModuleScope = {
  userId: string
  organizationId: string
  role: string
  isManager: boolean
}

// قاعدة الرؤية داخل المؤسسة الواحدة: المدير/الأدمن والمدير العام ومفتش السلامة يرَون
// كل سجلات مؤسستهم؛ بقية المستخدمين يرَون سجلاتهم فقط. (نفس القاعدة التي كانت مطبّقة
// في المخالفات والملاحظات، موحّدة الآن في مصدر واحد.)
export function isOrgManager(u: { role: string; department: string }): boolean {
  return (
    u.role === "admin" ||
    u.role === "manager" ||
    u.department === "المدير العام" ||
    u.department === "مفتش السلامة"
  )
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

// نطاق مراجع HSE مع معرّف المؤسسة — لعزل بيانات المراقبة/الكاميرات بين المؤسسات.
export async function requireHseReviewerScope(): Promise<ModuleScope> {
  const u = await requireUser()
  if (!isHseReviewer(u.role)) {
    throw new Error("هذه العملية مقصورة على مسؤول HSE (مدير أو أدمن)")
  }
  return { userId: u.id, organizationId: u.organizationId, role: u.role, isManager: isOrgManager(u) }
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

// النسخة الموصى بها لكل server action يقرأ/يكتب بيانات: تعيد النطاق الكامل (المستخدم
// + المؤسسة + هل هو مدير) بعد التحقق من صلاحية الوصول للقسم. تُبنى عليها كل الفلاتر.
export async function requireModuleScope(module: ModuleKey): Promise<ModuleScope> {
  const u = await requireUser()
  if (!hasModuleAccess(u.role, u.permissions, module)) {
    throw new Error("ليس لديك صلاحية للوصول إلى هذا القسم")
  }
  return { userId: u.id, organizationId: u.organizationId, role: u.role, isManager: isOrgManager(u) }
}

// نطاق عام (بلا تحقق قسم) للـ server actions التي تحتاج المؤسسة فقط بعد المصادقة.
export async function requireScope(): Promise<ModuleScope> {
  const u = await requireUser()
  return { userId: u.id, organizationId: u.organizationId, role: u.role, isManager: isOrgManager(u) }
}

// Returns the user without enforcing approval (for the /pending page itself).
export async function getCurrentUser(): Promise<AppUser | null> {
  return loadSessionUser()
}
