"use server"

import { db } from "@/lib/db"
import { incident, violation } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireModule, requireModuleScope, assertWritable } from "@/lib/session"
import { normalizeFinanceStatus, type FinanceStatus } from "@/lib/finance-status"
import { hasRoleSignature } from "@/lib/signature-check"
import { FINANCE_OFFICER_SIGNATURE_ROLE } from "@/lib/signature-roles"

function str(v: FormDataEntryValue | null, fallback = "") {
  return v == null ? fallback : String(v)
}

/* ---------------- قراءة المخالفات الخارجية المحوّلة للمالية ---------------- */

// قائمة مراجعة شاملة: من له صلاحية "finance" يرى كل المخالفات الخارجية بغض النظر
// عن منشئها (المخالفة الخارجية تُحال تلقائياً للمالية بمجرد كون التصنيف "external").
export async function getFinanceViolations() {
  const { organizationId } = await requireModuleScope("finance")
  return db
    .select()
    .from(violation)
    .where(and(eq(violation.organizationId, organizationId), eq(violation.category, "external")))
    .orderBy(desc(violation.createdAt))
}

// الحوادث المحوّلة صراحةً إلى المالية فقط، بغض النظر عن منشئها (داخل المؤسسة).
export async function getFinanceIncidents() {
  const { organizationId } = await requireModuleScope("finance")
  return db
    .select()
    .from(incident)
    .where(and(eq(incident.organizationId, organizationId), eq(incident.routedTo, "finance")))
    .orderBy(desc(incident.createdAt))
}

// عدد المخالفات والحوادث المالية غير المغلقة، لشارة الإشعار في القائمة الجانبية.
export async function getFinancePendingCount(): Promise<number> {
  const [violations, incidents] = await Promise.all([getFinanceViolations(), getFinanceIncidents()])
  const pendingViolations = violations.filter((v) => normalizeFinanceStatus(v.financeStatus) !== "closed").length
  const pendingIncidents = incidents.filter((i) => normalizeFinanceStatus(i.financeStatus) !== "closed").length
  return pendingViolations + pendingIncidents
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
  await assertWritable()
  const closer = await requireModule("finance")
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف غير صالح")

  // إلزام توقيع موظف المالية قبل إغلاق مخالفة قسم المالية فقط. الشرط مستقل عن
  // قسم الموارد البشرية، ولا يُطبَّق إلا عند محاولة الإغلاق (لا يعيق باقي التدفقات).
  const closing = normalizeFinanceStatus(str(formData.get("financeStatus"), "pending")) === "closed"
  if (closing) {
    const signed = await hasRoleSignature({
      organizationId: closer.organizationId,
      userId: closer.id,
      module: "violations",
      recordId: id,
      roleKey: FINANCE_OFFICER_SIGNATURE_ROLE.key,
    })
    if (!signed) {
      throw new Error("لا يمكن إغلاق المخالفة قبل حفظ توقيع موظف المالية")
    }
  }

  await db
    .update(violation)
    .set(buildFinanceUpdate(formData, closer.name))
    .where(and(eq(violation.id, id), eq(violation.organizationId, closer.organizationId)))

  revalidatePath("/finance")
  revalidatePath("/violations")
  revalidatePath("/")
}

export async function updateFinanceIncident(formData: FormData) {
  await assertWritable()
  const closer = await requireModule("finance")
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف غير صالح")

  // نفس شرط المخالفات: يُمنع إغلاق الحادثة المحوّلة إلى المالية قبل توقيع موظف
  // المالية. التوقيع مخزَّن تحت وحدة "incidents". الشرط مستقل عن قسم HR.
  const closing = normalizeFinanceStatus(str(formData.get("financeStatus"), "pending")) === "closed"
  if (closing) {
    const signed = await hasRoleSignature({
      organizationId: closer.organizationId,
      userId: closer.id,
      module: "incidents",
      recordId: id,
      roleKey: FINANCE_OFFICER_SIGNATURE_ROLE.key,
    })
    if (!signed) {
      throw new Error("لا يمكن إغلاق الحادثة قبل حفظ توقيع موظف المالية")
    }
  }

  await db
    .update(incident)
    .set(buildFinanceUpdate(formData, closer.name))
    .where(and(eq(incident.id, id), eq(incident.organizationId, closer.organizationId), eq(incident.routedTo, "finance")))

  revalidatePath("/finance")
  revalidatePath("/incidents")
  revalidatePath("/")
}
