"use server"

import { db } from "@/lib/db"
import { violation, incident } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireModule, requireModuleScope, assertWritable } from "@/lib/session"
import { normalizeHrStatus, type HrStatus } from "@/lib/hr-status"
import { hasRoleSignature } from "@/lib/signature-check"
import { HR_OFFICER_SIGNATURE_ROLE } from "@/lib/signature-roles"

function str(v: FormDataEntryValue | null, fallback = "") {
  return v == null ? fallback : String(v)
}
function dateOrNull(v: FormDataEntryValue | null) {
  const s = v ? String(v) : ""
  return s ? s : null
}

/* ---------------- قراءة البنود المحوّلة ---------------- */

// قائمة مراجعة شاملة: من له صلاحية "hr" يرى كل المخالفات الداخلية بغض النظر عن
// منشئها أو الحالة الرئيسية أو internalAction — يُعتمد على hrStatus للمعالَجة/الإغلاق.
export async function getHrViolations() {
  const { organizationId } = await requireModuleScope("hr")
  return db
    .select()
    .from(violation)
    .where(and(eq(violation.organizationId, organizationId), eq(violation.category, "internal")))
    .orderBy(desc(violation.createdAt))
}

// الحوادث المحوّلة صراحةً إلى الموارد البشرية فقط، بغض النظر عن منشئها (داخل المؤسسة).
export async function getHrIncidents() {
  const { organizationId } = await requireModuleScope("hr")
  return db
    .select()
    .from(incident)
    .where(and(eq(incident.organizationId, organizationId), eq(incident.routedTo, "hr")))
    .orderBy(desc(incident.createdAt))
}

// عدد البنود غير المعالجة (hrStatus غير مغلق) للشارة في القائمة الجانبية.
export async function getHrPendingCount(): Promise<number> {
  const [violations, incidents] = await Promise.all([getHrViolations(), getHrIncidents()])
  const pendingViolations = violations.filter((v) => normalizeHrStatus(v.hrStatus) !== "closed").length
  const pendingIncidents = incidents.filter((i) => normalizeHrStatus(i.hrStatus) !== "closed").length
  return pendingViolations + pendingIncidents
}

/* ---------------- تسجيل إجراء الموارد البشرية ---------------- */

// يبني قيم التحديث المشتركة لمسار HR من بيانات النموذج،
// مع فرض إلزامية "الإجراء المتخذ" عند الإغلاق وتسجيل من أغلق ومتى.
function buildHrUpdate(formData: FormData, closerName: string) {
  const hrStatus = normalizeHrStatus(str(formData.get("hrStatus"), "pending")) as HrStatus
  const hrAction = str(formData.get("hrAction"))
  const attachment = str(formData.get("hrAttachment")) // JSON array من data URLs

  if (hrStatus === "closed" && !hrAction.trim()) {
    throw new Error("الإجراء المتخذ إلزامي عند إغلاق الحالة")
  }

  // مزامنة حالة السجل الرئيسية مع مسار HR للحفاظ على مؤشرات مفتوح/مغلق.
  const mainStatus = hrStatus === "closed" ? "closed" : hrStatus === "in_review" ? "in_progress" : "open"

  return {
    hrAction,
    hrActionDate: dateOrNull(formData.get("hrActionDate")),
    hrNotes: str(formData.get("hrNotes")),
    hrStatus,
    hrAttachmentUrl: attachment,
    status: mainStatus,
    // سجّل المُغلِق والتاريخ عند الإغلاق فقط؛ وامسحهما إذا أُعيد فتح الحالة.
    hrClosedBy: hrStatus === "closed" ? closerName : "",
    hrClosedAt: hrStatus === "closed" ? new Date() : null,
  }
}

export async function updateHrViolation(formData: FormData) {
  await assertWritable()
  const closer = await requireModule("hr")
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف غير صالح")

  // إلزام توقيع موظف الموارد البشرية قبل إغلاق مخالفة قسم HR فقط. الشرط مستقل
  // عن قسم المالية، ولا يُطبَّق إلا عند محاولة الإغلاق (لا يعيق باقي التدفقات).
  const closing = normalizeHrStatus(str(formData.get("hrStatus"), "pending")) === "closed"
  if (closing) {
    const signed = await hasRoleSignature({
      organizationId: closer.organizationId,
      userId: closer.id,
      module: "violations",
      recordId: id,
      roleKey: HR_OFFICER_SIGNATURE_ROLE.key,
    })
    if (!signed) {
      throw new Error("لا يمكن إغلاق المخالفة قبل حفظ توقيع موظف الموارد البشرية")
    }
  }

  await db
    .update(violation)
    .set(buildHrUpdate(formData, closer.name))
    .where(and(eq(violation.id, id), eq(violation.organizationId, closer.organizationId)))

  revalidatePath("/hr")
  revalidatePath("/violations")
  revalidatePath("/")
}

export async function updateHrIncident(formData: FormData) {
  await assertWritable()
  const closer = await requireModule("hr")
  const id = Number(formData.get("id"))
  if (!Number.isFinite(id)) throw new Error("معرّف غير صالح")

  // نفس شرط المخالفات: يُمنع إغلاق الحادثة المحوّلة إلى HR قبل توقيع موظف الموارد
  // البشرية. التوقيع مخزَّن تحت وحدة "incidents". الشرط مستقل عن قسم المالية.
  const closing = normalizeHrStatus(str(formData.get("hrStatus"), "pending")) === "closed"
  if (closing) {
    const signed = await hasRoleSignature({
      organizationId: closer.organizationId,
      userId: closer.id,
      module: "incidents",
      recordId: id,
      roleKey: HR_OFFICER_SIGNATURE_ROLE.key,
    })
    if (!signed) {
      throw new Error("لا يمكن إغلاق الحادثة قبل حفظ توقيع موظف الموارد البشرية")
    }
  }

  await db
    .update(incident)
    .set(buildHrUpdate(formData, closer.name))
    .where(and(eq(incident.id, id), eq(incident.organizationId, closer.organizationId), eq(incident.routedTo, "hr")))

  revalidatePath("/hr")
  revalidatePath("/incidents")
  revalidatePath("/")
}
