"use server"

import { db } from "@/lib/db"
import { organization, company } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"

export type OrgOption = { id: string; name: string }

// بحث عام (قبل المصادقة) عن المؤسسات المعتمدة فقط، يغذّي حقل البحث في نموذج التسجيل.
// لا يعرض القائمة كاملة: يتطلب حرفين على الأقل، ويطابق جزئياً بلا حساسية لحالة الأحرف،
// ويعيد 8 نتائج كحدّ أقصى. المؤسسات قيد المراجعة/المرفوضة لا تظهر إطلاقاً.
export async function searchApprovedOrganizations(query: string): Promise<OrgOption[]> {
  const q = (query || "").trim().toLowerCase()
  if (q.length < 2) return []

  // نجلب المؤسسات المعتمدة فقط مع أحدث ملف شركة (للاسم المعروض)، ثم نرشّح في الذاكرة.
  // عدد المؤسسات المستأجِرة صغير، فالترشيح في الذاكرة كافٍ ويتجنّب تعقيد ilike.
  const [orgs, companies] = await Promise.all([
    db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(eq(organization.status, "approved"))
      .orderBy(desc(organization.createdAt)),
    db
      .select({ organizationId: company.organizationId, name: company.name })
      .from(company),
  ])

  // أحدث اسم شركة لكل مؤسسة (يُفضَّل على اسم المؤسسة الخام عند توفّره).
  const companyByOrg = new Map<string, string>()
  for (const c of companies) {
    if (c.name && c.name.trim() && !companyByOrg.has(c.organizationId)) {
      companyByOrg.set(c.organizationId, c.name.trim())
    }
  }

  const results: OrgOption[] = []
  for (const o of orgs) {
    const name = companyByOrg.get(o.id) || o.name || ""
    if (!name) continue
    if (name.toLowerCase().includes(q)) {
      results.push({ id: o.id, name })
      if (results.length >= 8) break
    }
  }
  return results
}
