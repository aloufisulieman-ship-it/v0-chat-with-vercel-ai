"use server"

import { db } from "@/lib/db"
import { organization, company, user as userTable } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requirePlatformAdmin } from "@/lib/session"
import { setEnteredOrg, clearEnteredOrg } from "@/lib/platform-admin"

export type OrganizationSummary = {
  id: string
  name: string
  sector: string
  employeeCount: number
  userCount: number
  approvedUserCount: number
  registeredAt: string
  status: "pending" | "approved" | "rejected"
  // قفل الإعداد الأولي لهذه المؤسسة، وهل طلب مديرها فتح التعديل (يحتاج إجراءً).
  settingsLocked: boolean
  settingsUnlockRequested: boolean
}

// ترتيب عرض الحالات: المؤسسات قيد المراجعة أولاً (تحتاج إجراءً)، ثم المعتمدة، ثم المرفوضة.
const STATUS_ORDER: Record<string, number> = { pending: 0, approved: 1, rejected: 2 }
function normalizeOrgStatus(s: string | null | undefined): "pending" | "approved" | "rejected" {
  return s === "approved" || s === "rejected" ? s : "pending"
}

// قائمة كل المؤسسات المسجّلة — حصرية لمسؤول المنصّة (رؤية عابرة للمؤسسات، الاستثناء
// الوحيد المسموح لكسر عزل المؤسسات، ومحميّ بدور platform_admin).
export async function listOrganizations(): Promise<OrganizationSummary[]> {
  await requirePlatformAdmin()

  const [orgs, companies, users] = await Promise.all([
    db.select().from(organization).orderBy(desc(organization.createdAt)),
    db
      .select({
        organizationId: company.organizationId,
        name: company.name,
        industry: company.industry,
        employeeCount: company.employeeCount,
      })
      .from(company),
    db
      .select({ organizationId: userTable.organizationId, status: userTable.status })
      .from(userTable),
  ])

  // أحدث ملف شركة لكل مؤسسة (القائمة مرتّبة تنازلياً بالإنشاء، فأول ظهور هو الأحدث).
  const companyByOrg = new Map<string, { name: string; industry: string | null; employeeCount: number | null }>()
  for (const c of companies) {
    if (!companyByOrg.has(c.organizationId)) {
      companyByOrg.set(c.organizationId, { name: c.name, industry: c.industry, employeeCount: c.employeeCount })
    }
  }

  const counts = new Map<string, { total: number; approved: number }>()
  for (const u of users) {
    const key = u.organizationId ?? ""
    if (!key) continue
    const cur = counts.get(key) ?? { total: 0, approved: 0 }
    cur.total += 1
    if (u.status === "approved") cur.approved += 1
    counts.set(key, cur)
  }

  return orgs
    .map((o): OrganizationSummary => {
      const c = companyByOrg.get(o.id)
      const cnt = counts.get(o.id) ?? { total: 0, approved: 0 }
      const name = (c?.name && c.name.trim()) || o.name || "مؤسسة بدون اسم"
      return {
        id: o.id,
        name,
        sector: (c?.industry && c.industry.trim()) || "غير محدد",
        employeeCount: c?.employeeCount ?? 0,
        userCount: cnt.total,
        approvedUserCount: cnt.approved,
        registeredAt: o.createdAt.toISOString(),
        status: normalizeOrgStatus(o.status),
        settingsLocked: o.settingsLocked ?? false,
        settingsUnlockRequested: o.settingsUnlockRequested ?? false,
      }
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
}

// دخول مسؤول المنصّة إلى مساحة مؤسسة (عرض للقراءة فقط). يضبط الكوكي الموقّع ثم يوجّه
// إلى لوحة المؤسسة. يتحقق من وجود المؤسسة ومن الدور.
export async function enterOrganization(orgId: string): Promise<void> {
  await requirePlatformAdmin()
  const rows = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, orgId)).limit(1)
  if (!rows[0]) throw new Error("المؤسسة غير موجودة")
  await setEnteredOrg(orgId)
  revalidatePath("/", "layout")
  redirect("/")
}

// خروج مسؤول المنصّة من مساحة المؤسسة والعودة إلى قائمة المؤسسات.
export async function exitOrganization(): Promise<void> {
  await requirePlatformAdmin()
  await clearEnteredOrg()
  revalidatePath("/", "layout")
  redirect("/admin/organizations")
}

// اسم العرض للمؤسسة المدخول إليها حالياً (للافتة العرض)، أو "" إن لا يوجد.
export async function getEnteredOrgName(organizationId: string): Promise<string> {
  if (!organizationId) return ""
  const [comp] = await db
    .select({ name: company.name })
    .from(company)
    .where(eq(company.organizationId, organizationId))
    .limit(1)
  if (comp?.name && comp.name.trim()) return comp.name.trim()
  const [org] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, organizationId)).limit(1)
  return org?.name || ""
}

// يتحقق من وجود المؤسسة ويعيد صفها، وإلا يرمي خطأً. حصري لمسؤول المنصّة (يُتحقق قبله).
async function assertOrgExists(orgId: string): Promise<void> {
  const [row] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, orgId)).limit(1)
  if (!row) throw new Error("المؤسسة غير موجودة")
}

// اعتماد مؤسسة: تتحوّل حالتها إلى approved، ويُعتمد مديرها الأول (دور admin) ليتمكّن من
// الدخول واستخدام النظام. لا نعتمد بقية الأعضاء — يديرهم مدير المؤسسة بنفسه لاحقاً.
export async function approveOrganization(orgId: string): Promise<{ success: true }> {
  await requirePlatformAdmin()
  await assertOrgExists(orgId)
  const now = new Date()
  await db.update(organization).set({ status: "approved", updatedAt: now }).where(eq(organization.id, orgId))
  await db
    .update(userTable)
    .set({ status: "approved", updatedAt: now })
    .where(and(eq(userTable.organizationId, orgId), eq(userTable.role, "admin")))
  revalidatePath("/admin/organizations")
  return { success: true }
}

// رفض مؤسسة: تتحوّل حالتها إلى rejected ويُحجب كل مستخدميها (status=rejected) فيرَون
// رسالة الرفض في صفحة الانتظار.
export async function rejectOrganization(orgId: string): Promise<{ success: true }> {
  await requirePlatformAdmin()
  await assertOrgExists(orgId)
  const now = new Date()
  await db.update(organization).set({ status: "rejected", updatedAt: now }).where(eq(organization.id, orgId))
  await db
    .update(userTable)
    .set({ status: "rejected", updatedAt: now })
    .where(eq(userTable.organizationId, orgId))
  revalidatePath("/admin/organizations")
  return { success: true }
}

// تعديل اسم المؤسسة من لوحة المنصّة (الحقل الوحيد القابل للتعديل قبل اكتمال ملف الشركة).
export async function updateOrganizationName(orgId: string, name: string): Promise<{ success: true; error?: string }> {
  await requirePlatformAdmin()
  await assertOrgExists(orgId)
  const trimmed = (name || "").trim()
  if (!trimmed) return { success: true, error: "الاسم مطلوب" }
  await db
    .update(organization)
    .set({ name: trimmed.slice(0, 200), updatedAt: new Date() })
    .where(eq(organization.id, orgId))
  revalidatePath("/admin/organizations")
  return { success: true }
}

// فتح تعديل الإعدادات لمؤسسة بعد قفلها (استجابةً لطلب مديرها). يعيد settingsLocked إلى
// false فيتمكّن مدير المؤسسة من تعديل المعلومات والإعدادات مجدداً (ويُقفل تلقائياً بعد
// أول حفظ لاحق). يمسح علامة الطلب. حصري لمسؤول المنصّة.
export async function unlockOrganizationSettings(orgId: string): Promise<{ success: true }> {
  await requirePlatformAdmin()
  await assertOrgExists(orgId)
  await db
    .update(organization)
    .set({ settingsLocked: false, settingsUnlockRequested: false, updatedAt: new Date() })
    .where(eq(organization.id, orgId))
  revalidatePath("/admin/organizations")
  return { success: true }
}
