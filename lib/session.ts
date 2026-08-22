import { cache } from "react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { hasModuleAccess, isPlatformAdmin, type ModuleKey } from "@/lib/permissions"
import { getEnteredOrgId } from "@/lib/platform-admin"

export type AppUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
  department: string
  permissions: string
  locale: string
  // المؤسسة الفعّالة للطلب. لمستخدم عادي: مؤسسته. لمسؤول منصّة داخلٍ إلى مؤسسة: تلك
  // المؤسسة (انتحال قراءة فقط). الحدّ الأعلى للعزل تُبنى عليه كل الاستعلامات.
  organizationId: string
  // هل الدور مسؤول منصّة (فوق المؤسسات).
  isPlatformAdmin: boolean
  // هل مسؤول المنصّة داخلٌ حالياً إلى مؤسسة (وضع العرض/الانتحال) — يفرض القراءة فقط.
  impersonating: boolean
  // مؤسسة مسؤول المنصّة الأصلية (قبل الدخول) — للعرض فقط، غالباً فارغة.
  homeOrganizationId: string
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
  // صحيح عندما يكون الطلب في وضع انتحال مسؤول المنصّة — تُمنع كل التعديلات.
  readOnly: boolean
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
  const row = rows[0]
  if (!row) return null
  // العمود nullable على مستوى قاعدة البيانات (الإنشاء على مرحلتين)، لكن أي مستخدم
  // معتمد يملك مؤسسة فعلية دائماً (تُعيَّن ذرّياً مع الاعتماد). نوحّد النوع إلى string.
  const homeOrganizationId = row.organizationId ?? ""
  const platformAdmin = isPlatformAdmin(row.role)

  // مسؤول المنصّة فقط يمكنه "الدخول" إلى مؤسسة: عندئذٍ تصبح المؤسسة الفعّالة هي المؤسسة
  // المدخول إليها، ويُفعّل وضع القراءة فقط. الكوكي موقّع، والدور يُتحقق منه هنا حصراً
  // فلا يستفيد أي مستخدم آخر من وجود الكوكي.
  let organizationId = homeOrganizationId
  let impersonating = false
  if (platformAdmin) {
    const entered = await getEnteredOrgId()
    if (entered) {
      organizationId = entered
      impersonating = true
    }
  }

  return {
    ...row,
    organizationId,
    isPlatformAdmin: platformAdmin,
    impersonating,
    homeOrganizationId,
  }
})

// هل يُسمح لهذا المستخدم برؤية القسم؟ مسؤول المنصّة يُمنح وصول قراءة لكل الأقسام أثناء
// دخوله إلى مؤسسة فقط؛ خارج وضع الدخول لا يملك أي رؤية داخل التطبيق.
function moduleAllowed(u: AppUser, module: ModuleKey): boolean {
  if (u.isPlatformAdmin) return u.impersonating
  return hasModuleAccess(u.role, u.permissions, module)
}

// يبني كائن النطاق الموحّد من مستخدم مُحمّل. مسؤول المنصّة أثناء الدخول يُعامَل معاملة
// المدير (يرى كل سجلات المؤسسة) لكن للقراءة فقط.
function scopeFrom(u: AppUser): ModuleScope {
  return {
    userId: u.id,
    organizationId: u.organizationId,
    role: u.role,
    isManager: u.isPlatformAdmin ? true : isOrgManager(u),
    readOnly: u.impersonating,
  }
}

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

// مسؤول المنصّة أثناء الدخول إلى مؤسسة يُعامَل معاملة المراجع (قراءة فقط).
function isReviewerUser(u: AppUser): boolean {
  return isHseReviewer(u.role) || (u.isPlatformAdmin && u.impersonating)
}

// حارس صفحات المراجعة: يعيد المستخدم إن كان مراجعاً، وإلا يوجّهه لصفحة عدم التصريح.
export async function requireHseReviewer(): Promise<AppUser> {
  const u = await requireUser()
  if (u.isPlatformAdmin && !u.impersonating) redirect("/admin/organizations")
  if (!isReviewerUser(u)) redirect("/ai-monitoring/unauthorized")
  return u
}

// نسخة لاستخدامها داخل server actions: ترمي خطأً بدل التوجيه.
export async function requireHseReviewerId(): Promise<string> {
  const u = await requireUser()
  if (!isReviewerUser(u)) {
    throw new Error("هذه العملية مقصورة على مسؤول HSE (مدير أو أدمن)")
  }
  return u.id
}

// نطاق مراجع HSE مع معرّف المؤسسة — لعزل بيانات المراقبة/الكاميرات بين المؤسسات.
export async function requireHseReviewerScope(): Promise<ModuleScope> {
  const u = await requireUser()
  if (!isReviewerUser(u)) {
    throw new Error("هذه العملية مقصورة على مسؤول HSE (مدير أو أدمن)")
  }
  return scopeFrom(u)
}

// Requires the user to have access to a given module, else sends them home.
export async function requireModule(module: ModuleKey): Promise<AppUser> {
  const u = await requireUser()
  // مسؤول المنصّة خارج وضع الدخول ليس له مكان داخل التطبيق — نوجّهه إلى قائمة المؤسسات.
  if (u.isPlatformAdmin && !u.impersonating) redirect("/admin/organizations")
  if (!moduleAllowed(u, module)) redirect("/")
  return u
}

// Throws when the user cannot access a module. Use inside server actions.
export async function requireModuleUserId(module: ModuleKey): Promise<string> {
  const u = await requireUser()
  if (!moduleAllowed(u, module)) {
    throw new Error("ليس لديك صلاحية للوصول إلى هذا القسم")
  }
  return u.id
}

// النسخة الموصى بها لكل server action يقرأ/يكتب بيانات: تعيد النطاق الكامل (المستخدم
// + المؤسسة + هل هو مدير + هل القراءة فقط) بعد التحقق من صلاحية الوصول للقسم.
export async function requireModuleScope(module: ModuleKey): Promise<ModuleScope> {
  const u = await requireUser()
  if (!moduleAllowed(u, module)) {
    throw new Error("ليس لديك صلاحية للوصول إلى هذا القسم")
  }
  return scopeFrom(u)
}

// نطاق عام (بلا تحقق قسم) للـ server actions التي تحتاج المؤسسة فقط بعد المصادقة.
export async function requireScope(): Promise<ModuleScope> {
  const u = await requireUser()
  return scopeFrom(u)
}

// Returns the user without enforcing approval (for the /pending page itself).
export async function getCurrentUser(): Promise<AppUser | null> {
  return loadSessionUser()
}

// حارس الكتابة الموحّد: يُستدعى في مطلع كل server action يعدّل بيانات. يمنع أي تعديل
// أثناء وضع انتحال مسؤول المنصّة (عرض المؤسسة = قراءة فقط). مستقل عن ترتيب الاستدعاء
// وعن أي helper نطاق استُخدم، فلا يمكن تفويته بتغيير مصدر النطاق.
export async function assertWritable(): Promise<void> {
  const u = await loadSessionUser()
  if (u?.impersonating) {
    throw new Error("وضع عرض المؤسسة للقراءة فقط — لا يمكن إجراء تعديلات أثناء دخول مسؤول المنصّة")
  }
}

// حارس صفحات مسؤول المنصّة: يعيد المستخدم إن كان platform_admin، وإلا يوجّهه للجذر.
export async function requirePlatformAdmin(): Promise<AppUser> {
  const u = await requireUser()
  if (!u.isPlatformAdmin) redirect("/")
  return u
}
