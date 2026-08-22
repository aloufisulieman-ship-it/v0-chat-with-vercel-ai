"use server"

import { db } from "@/lib/db"
import { organization, company, user as userTable } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
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
  status: "active" | "pending"
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

  return orgs.map((o) => {
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
      status: cnt.approved > 0 ? "active" : "pending",
    }
  })
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
