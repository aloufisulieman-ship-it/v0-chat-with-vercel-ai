"use server"

import { db } from "@/lib/db"
import { violation } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireModule, requireModuleUserId } from "@/lib/session"
import { normalizeFinanceStatus, type FinanceStatus } from "@/lib/finance-status"

function str(v: FormDataEntryValue | null, fallback = "") {
  return v == null ? fallback : String(v)
}

/* ---------------- قراءة المخالفات الخارجية المحوّلة للمالية ---------------- */

// قائمة مراجعة شاملة: من له صلاحية "finance" يرى كل المخالفات الخارجية بغض النظر
// عن منشئها (المخالفة الخارجية تُحال تلقائياً للمالية بمجرد كون التصنيف "external").
export async function getFinanceViolations() {
  await requireModuleUserId("finance")
  return db
    .select()
    .from(violation)
    .where(eq(violation.category, "external"))
    .orderBy(desc(violation.createdAt))
}

// عدد المخالفات الخارجية غير المغلقة، لشارة الإشعار في القائمة الجانبية.
export async function getFinancePendingCount(): Promise<number> {
  const violations = await getFinanceViolations()
  return violations.filter((v) => normalizeFinanceStatus(v.financeStatus) !== "closed").length
}

/* ---------------- تسجيل إجراء المالية / إغلاق الحالة ---------------- */

// يبني قيم التحديث لمسار المالية من بيانات النموذج، مع فرض إلزامية
// رقم الستلمنت وإيصال الدفع عند الإغلاق، وتسجيل من أغلق ومتى.
function buildFinanceUpdate(formData: FormData, closerName: string) {
  const financeStatus = normalizeFinanceStatus(str(formData.get("financeStatus"), "pending")) as FinanceStatus
  const settlementNumber = str(formData.get("settlementNumber")).trim()
  const paymentReceiptUrl = str(formData.get("paymentReceipt")) // data URL واحد لإيصال الدفع

  if (financeStatus === "closed") {
    if (!settlementNumber) throw new Error("رقم الستلمنت إلزامي عند إغلاق الحالة")
    if (!paymentReceiptUrl) throw new Error("إيصال الدفع إلزامي عند إغلاق الحالة")
  }

  // مزامنة حالة السجل الرئيسية مع مسار المالية للحفاظ على مؤشرات مفتوح/مغلق.
  const mainStatus = financeStatus === "closed" ? "closed" : financeStatus === "in_review" ? "in_progress" : "open"

  return {
    financeStatus,
    settlementNumber,
    paymentReceiptUrl,
    status: mainStatus,
    // سجّل المُغلِق والتاريخ عند الإغلاق فقط؛ وامسحهما إذا أُعيد فتح الحالة.
    financeClosedBy: financeStatus === "closed" ? closerName : "",
    financeClosedAt: financeStatus === "closed" ? new Date() : null,
  }
}

export async function updateFinanceViolation(formData: FormData) {
  const closer = await requireModule("finance")
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف غير صالح")

  await db
    .update(violation)
    .set(buildFinanceUpdate(formData, closer.name))
    .where(eq(violation.id, id))

  revalidatePath("/finance")
  revalidatePath("/violations")
  revalidatePath("/")
}
