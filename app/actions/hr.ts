"use server"

import { db } from "@/lib/db"
import { violation, incident } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireModule, requireModuleScope, assertWritable } from "@/lib/session"
import { normalizeHrStatus, type HrStatus } from "@/lib/hr-status"
import { hasRoleSignature } from "@/lib/signature-check"
import { HR_OFFICER_SIGNATURE_ROLE } from "@/lib/signature-roles"
import { assertNotArchived, logRecordEvent } from "@/app/actions/lifecycle"
import { normalizeLifecycle } from "@/lib/lifecycle"

// مزامنة دورة الحياة الموحّدة مع مسار HR القديم: pending→referred، in_review→in_progress،
// closed→archived (مع أحداث سجل الحركة).
function lifecycleFromHr(hrStatus: HrStatus, now: Date, closer: string) {
  if (hrStatus === "closed") {
    return {
      lifecycleStatus: "archived",
      lifecycleClosedAt: now,
      lifecycleClosedBy: closer,
      archivedAt: now,
    }
  }
  return { lifecycleStatus: hrStatus === "in_review" ? "in_progress" : "referred", archivedAt: null }
}

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
  const now = new Date()

  return {
    hrAction,
    hrActionDate: dateOrNull(formData.get("hrActionDate")),
    hrNotes: str(formData.get("hrNotes")),
    hrStatus,
    hrAttachmentUrl: attachment,
    status: mainStatus,
    // سجّل المُغلِق والتاريخ عند الإغلاق فقط؛ وامسحهما إذا أُعيد فتح الحالة.
    hrClosedBy: hrStatus === "closed" ? closerName : "",
    hrClosedAt: hrStatus === "closed" ? now : null,
    closureAction: hrStatus === "closed" ? hrAction : undefined,
    ...lifecycleFromHr(hrStatus, now, closerName),
  }
}

// يسجّل أحداث دورة الحياة الناتجة عن تغيير حالة HR.
async function logHrTransition(
  module: "violations" | "incidents",
  recordId: number,
  organizationId: string,
  from: string | null | undefined,
  hrStatus: HrStatus,
  actor: { id: string; name: string },
  note: string,
) {
  const fromStatus = normalizeLifecycle(from)
  const to = hrStatus === "closed" ? "closed" : hrStatus === "in_review" ? "in_progress" : "referred"
  if (fromStatus === to || (to === "referred" && fromStatus === "referred")) return
  const base = { organizationId, module, recordId, userId: actor.id, userName: actor.name }
  if (to === "closed") {
    await logRecordEvent({ ...base, event: "closed", fromStatus, toStatus: "closed", note })
    await logRecordEvent({ ...base, event: "archived", fromStatus: "closed", toStatus: "archived" })
  } else if (to === "in_progress") {
    await logRecordEvent({ ...base, event: "in_progress", fromStatus, toStatus: "in_progress" })
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

  await assertNotArchived("violations", id, closer.organizationId)
  const [before] = await db
    .select({ lifecycleStatus: violation.lifecycleStatus })
    .from(violation)
    .where(and(eq(violation.id, id), eq(violation.organizationId, closer.organizationId)))
    .limit(1)

  const update = buildHrUpdate(formData, closer.name)
  await db
    .update(violation)
    .set(update)
    .where(and(eq(violation.id, id), eq(violation.organizationId, closer.organizationId)))
  await logHrTransition("violations", id, closer.organizationId, before?.lifecycleStatus, update.hrStatus, closer, update.hrAction)

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

  await assertNotArchived("incidents", id, closer.organizationId)
  const [before] = await db
    .select({ lifecycleStatus: incident.lifecycleStatus })
    .from(incident)
    .where(and(eq(incident.id, id), eq(incident.organizationId, closer.organizationId)))
    .limit(1)

  const update = buildHrUpdate(formData, closer.name)
  await db
    .update(incident)
    .set(update)
    .where(and(eq(incident.id, id), eq(incident.organizationId, closer.organizationId), eq(incident.routedTo, "hr")))
  await logHrTransition("incidents", id, closer.organizationId, before?.lifecycleStatus, update.hrStatus, closer, update.hrAction)

  revalidatePath("/hr")
  revalidatePath("/incidents")
  revalidatePath("/")
}
