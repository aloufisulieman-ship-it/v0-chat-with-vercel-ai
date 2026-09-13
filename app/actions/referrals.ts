"use server"

import { db } from "@/lib/db"
import { department, referral, referralEvent, user } from "@/lib/db/schema"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireScope, requireModuleScope, assertWritable, requireUser, isOrgManager } from "@/lib/session"
import {
  computeDueAt,
  isReferralStatus,
  isSourceType,
  type ReferralSourceType,
  type ReferralStatus,
} from "@/lib/departments"

// كل استعلامات الإحالات معزولة بـ organizationId فقط (لا مالك فردي للسجل): الإحالة
// مورد مشترك على مستوى القسم داخل المؤسسة. الكتابة تمرّ دائماً عبر requireModuleScope
// ("departments") + assertWritable لمنع التعديل في وضع انتحال مسؤول المنصّة.

type Attachment = { url: string; name?: string; kind?: string }

// يبني رقم الإحالة البشري REF-YYYY-### تسلسلياً لكل مؤسسة/سنة داخل معاملة.
async function nextRefNo(tx: typeof db, organizationId: string, year: number): Promise<string> {
  const rows = await tx
    .select({ refNo: referral.refNo })
    .from(referral)
    .where(and(eq(referral.organizationId, organizationId), sql`${referral.refNo} LIKE ${`REF-${year}-%`}`))
  let max = 0
  for (const r of rows) {
    const m = /^REF-\d{4}-(\d+)$/.exec(r.refNo)
    if (m) max = Math.max(max, Number.parseInt(m[1], 10))
  }
  return `REF-${year}-${String(max + 1).padStart(3, "0")}`
}

// يعيد قسماً داخل المؤسسة بمعرّفه، مع التحقق من العزل.
async function getDeptInOrg(organizationId: string, deptId: number) {
  const rows = await db
    .select()
    .from(department)
    .where(and(eq(department.id, deptId), eq(department.organizationId, organizationId)))
    .limit(1)
  return rows[0] ?? null
}

// ---------- قراءات ----------

// قائمة أقسام المؤسسة الفعّالة.
export async function getDepartments() {
  const scope = await requireScope()
  return db
    .select()
    .from(department)
    .where(eq(department.organizationId, scope.organizationId))
    .orderBy(asc(department.id))
}

// قسم واحد برمزه (HSE/HR/FIN/...).
export async function getDepartmentByCode(code: string) {
  const scope = await requireScope()
  const rows = await db
    .select()
    .from(department)
    .where(and(eq(department.organizationId, scope.organizationId), eq(department.code, code)))
    .limit(1)
  return rows[0] ?? null
}

// مصفوفة النظرة العامة: لكل قسم عدد الإحالات الواردة المفتوحة والمتأخرة والمغلقة.
export async function getDepartmentsOverview() {
  const scope = await requireScope()
  const depts = await db
    .select()
    .from(department)
    .where(eq(department.organizationId, scope.organizationId))
    .orderBy(asc(department.id))

  const counts = await db
    .select({
      toDeptId: referral.toDeptId,
      status: referral.status,
      overdue: sql<number>`count(*) FILTER (WHERE ${referral.status} <> 'closed' AND ${referral.dueAt} IS NOT NULL AND ${referral.dueAt} < now())`,
      total: sql<number>`count(*)`,
    })
    .from(referral)
    .where(eq(referral.organizationId, scope.organizationId))
    .groupBy(referral.toDeptId, referral.status)

  const byDept = new Map<number, { open: number; closed: number; overdue: number; total: number }>()
  for (const d of depts) byDept.set(d.id, { open: 0, closed: 0, overdue: 0, total: 0 })
  for (const c of counts) {
    const agg = byDept.get(c.toDeptId)
    if (!agg) continue
    const n = Number(c.total)
    agg.total += n
    if (c.status === "closed") agg.closed += n
    else agg.open += n
    agg.overdue += Number(c.overdue)
  }

  return depts.map((d) => ({ ...d, stats: byDept.get(d.id)! }))
}

// صندوق وارد قسم: الإحالات الواردة إليه، مع فلترة اختيارية بالحالة/النوع.
export async function getDepartmentInbox(
  code: string,
  filters?: { status?: ReferralStatus | "open" | "all"; sourceType?: ReferralSourceType },
) {
  const scope = await requireScope()
  const dept = await getDepartmentByCode(code)
  if (!dept) return { dept: null, items: [] as (typeof referral.$inferSelect)[] }

  const conds = [eq(referral.organizationId, scope.organizationId), eq(referral.toDeptId, dept.id)]
  const status = filters?.status ?? "all"
  if (status === "open") conds.push(sql`${referral.status} <> 'closed'`)
  else if (status !== "all") conds.push(eq(referral.status, status))
  if (filters?.sourceType) conds.push(eq(referral.sourceType, filters.sourceType))

  const items = await db
    .select()
    .from(referral)
    .where(and(...conds))
    .orderBy(desc(referral.createdAt))
  return { dept, items }
}

// خط زمن إحالة واحدة مع أحداثها (بعد التحقق من العزل).
export async function getReferralWithTimeline(referralId: number) {
  const scope = await requireScope()
  const rows = await db
    .select()
    .from(referral)
    .where(and(eq(referral.id, referralId), eq(referral.organizationId, scope.organizationId)))
    .limit(1)
  const ref = rows[0]
  if (!ref) return null
  const events = await db
    .select()
    .from(referralEvent)
    .where(eq(referralEvent.referralId, referralId))
    .orderBy(asc(referralEvent.createdAt))
  return { referral: ref, events }
}

// خط سير كامل لسجل تشغيلي: يجمع أحداث كل تحويلات نفس السجل المصدر (نفس sourceType+sourceId)
// لا تحويل واحد فقط — لأن التحويل من قسم لآخر يُغلق تحويلاً ويُنشئ آخر مرتبطاً بنفس المصدر.
// يُطابَق الفاعل بجدول المستخدم لإظهار الوظيفة والقسم. القراءة معزولة بـ organizationId.
export async function getReferralChainByRefNo(code: string, refNo: string) {
  const scope = await requireScope()

  const base = await db
    .select()
    .from(referral)
    .where(and(eq(referral.organizationId, scope.organizationId), eq(referral.refNo, refNo)))
    .limit(1)
  const ref = base[0]
  if (!ref) return null

  // سلسلة التحويلات لنفس السجل المصدر، بترتيب الإنشاء.
  const chain = await db
    .select()
    .from(referral)
    .where(
      and(
        eq(referral.organizationId, scope.organizationId),
        eq(referral.sourceType, ref.sourceType),
        eq(referral.sourceId, ref.sourceId),
      ),
    )
    .orderBy(asc(referral.createdAt))
  const chainIds = chain.map((c) => c.id)
  const refById = new Map(chain.map((c) => [c.id, c]))

  const depts = await db
    .select()
    .from(department)
    .where(eq(department.organizationId, scope.organizationId))
  const deptById = new Map(depts.map((d) => [d.id, d]))

  // أحداث كل تحويلات السلسلة، مطابقة الفاعل بجدول المستخدم (الوظيفة/القسم)، بترتيب زمني.
  const rows = await db
    .select({
      id: referralEvent.id,
      referralId: referralEvent.referralId,
      actorName: referralEvent.actorName,
      action: referralEvent.action,
      fromStatus: referralEvent.fromStatus,
      toStatus: referralEvent.toStatus,
      comment: referralEvent.comment,
      createdAt: referralEvent.createdAt,
      actorRole: user.role,
      actorDept: user.department,
    })
    .from(referralEvent)
    .leftJoin(user, eq(user.id, referralEvent.actorId))
    .where(and(eq(referralEvent.organizationId, scope.organizationId), inArray(referralEvent.referralId, chainIds)))
    .orderBy(asc(referralEvent.createdAt), asc(referralEvent.id))

  const events = rows.map((e) => {
    const r = refById.get(e.referralId)
    const stageDept = r ? deptById.get(r.toDeptId) : null
    return {
      id: e.id,
      action: e.action,
      actorName: e.actorName,
      actorRole: e.actorRole ?? "",
      actorDept: e.actorDept ?? "",
      stageDeptName: stageDept?.nameAr || stageDept?.code || "",
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      comment: e.comment,
      createdAt: e.createdAt.toISOString(),
    }
  })

  // ملخّص المعاملة: المدة الكلية، عدد الأقسام، مرات الإرجاع، والالتزام بالمهلة.
  const last = chain[chain.length - 1]
  const firstCreatedAt = chain[0]?.createdAt ?? ref.createdAt
  const closed = last.status === "closed"
  const endedAt = closed && last.closedAt ? last.closedAt : new Date()
  const governingDueAt = last.dueAt
  const distinctDepts = new Set(chain.map((c) => c.toDeptId))
  const returnCount = events.filter((e) => e.action === "returned").length
  const lateMs = governingDueAt ? endedAt.getTime() - governingDueAt.getTime() : 0

  const summary = {
    firstCreatedAt: firstCreatedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    closed,
    totalMs: endedAt.getTime() - firstCreatedAt.getTime(),
    deptCount: distinctDepts.size,
    returnCount,
    dueAt: governingDueAt ? governingDueAt.toISOString() : null,
    lateHours: lateMs > 0 ? Math.ceil(lateMs / 3_600_000) : 0,
    withinSla: governingDueAt ? lateMs <= 0 : true,
  }

  const chainDepts = chain.map((c) => {
    const d = deptById.get(c.toDeptId)
    return { refNo: c.refNo, code: d?.code ?? "", nameAr: d?.nameAr || d?.code || "", status: c.status }
  })

  return {
    referral: {
      id: ref.id,
      refNo: ref.refNo,
      sourceType: ref.sourceType,
      sourceId: ref.sourceId,
      status: ref.status,
      priority: ref.priority,
    },
    deptCode: code.toUpperCase(),
    events,
    chainDepts,
    summary,
  }
}

// إحالات سجل تشغيلي بعينه (لعرضها داخل صفحة المخالفة/الحادث لاحقاً).
export async function getReferralsForSource(sourceType: ReferralSourceType, sourceId: number) {
  const scope = await requireScope()
  return db
    .select()
    .from(referral)
    .where(
      and(
        eq(referral.organizationId, scope.organizationId),
        eq(referral.sourceType, sourceType),
        eq(referral.sourceId, sourceId),
      ),
    )
    .orderBy(desc(referral.createdAt))
}

// بيانات قسم «الأقسام» في القائمة الجانبية: تُبنى ديناميكياً حسب دور المستخدم وارتباطه.
// المدير/المدير العام/مفتش السلامة/مسؤول المنصّة يرون كل الأقسام + «نظرة عامة»؛ المستخدم
// العادي المرتبط باسم قسم واحد يرى قسمه فقط («واردي»)؛ غير ذلك لا يرى القسم إطلاقاً.
export async function getDepartmentsNav() {
  const u = await requireUser()
  const manager = u.isPlatformAdmin ? true : isOrgManager({ role: u.role, department: u.department })

  const depts = await db
    .select()
    .from(department)
    .where(and(eq(department.organizationId, u.organizationId), eq(department.isActive, true)))
    .orderBy(asc(department.id))

  const counts = await db
    .select({
      toDeptId: referral.toDeptId,
      open: sql<number>`count(*) FILTER (WHERE ${referral.status} <> 'closed')`,
      overdue: sql<number>`count(*) FILTER (WHERE ${referral.status} <> 'closed' AND ${referral.dueAt} IS NOT NULL AND ${referral.dueAt} < now())`,
    })
    .from(referral)
    .where(eq(referral.organizationId, u.organizationId))
    .groupBy(referral.toDeptId)

  const openByDept = new Map<number, number>()
  const overdueByDept = new Map<number, number>()
  for (const c of counts) {
    openByDept.set(c.toDeptId, Number(c.open))
    overdueByDept.set(c.toDeptId, Number(c.overdue))
  }

  if (manager) {
    const list = depts.map((d) => ({ code: d.code, nameAr: d.nameAr, open: openByDept.get(d.id) ?? 0 }))
    const overdueTotal = depts.reduce((s, d) => s + (overdueByDept.get(d.id) ?? 0), 0)
    return { visible: true, mode: "group" as const, canSeeOverview: true, overdueTotal, departments: list }
  }

  // مستخدم عادي: يُطابَق اسم قسمه (حقل department الحر) باسم قسم فعّال في مؤسسته.
  const mine = depts.find((d) => d.nameAr.trim() !== "" && d.nameAr.trim() === u.department.trim())
  if (mine) {
    return {
      visible: true,
      mode: "single" as const,
      canSeeOverview: false,
      overdueTotal: overdueByDept.get(mine.id) ?? 0,
      departments: [{ code: mine.code, nameAr: mine.nameAr, open: openByDept.get(mine.id) ?? 0 }],
    }
  }

  return { visible: false, mode: "none" as const, canSeeOverview: false, overdueTotal: 0, departments: [] }
}

// ---------- كتابات ----------

// إنشاء إحالة من سجل تشغيلي إلى قسم. يحسب due_at من مهلة القسم ويسجّل حدث الإنشاء.
export async function createReferral(input: {
  sourceType: string
  sourceId: number
  toDeptCode: string
  fromDeptCode?: string
  priority?: string
  notes?: string
  assignedToUserId?: string
  attachments?: Attachment[]
}) {
  const scope = await requireModuleScope("departments")
  await assertWritable()
  const u = await requireUser()

  if (!isSourceType(input.sourceType)) throw new Error("نوع سجل غير معروف")
  if (!input.sourceId || input.sourceId < 1) throw new Error("معرّف السجل غير صالح")

  const toDept = await getDepartmentByCode(input.toDeptCode)
  if (!toDept) throw new Error("القسم المستهدف غير موجود")
  const fromDept = input.fromDeptCode ? await getDepartmentByCode(input.fromDeptCode) : null

  const priority = ["low", "medium", "high", "critical"].includes(input.priority ?? "")
    ? input.priority!
    : "medium"

  const now = new Date()
  const created = await db.transaction(async (tx) => {
    const refNo = await nextRefNo(tx as unknown as typeof db, scope.organizationId, now.getFullYear())
    const inserted = await tx
      .insert(referral)
      .values({
        organizationId: scope.organizationId,
        refNo,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        fromDeptId: fromDept?.id ?? null,
        toDeptId: toDept.id,
        priority,
        status: "new",
        assignedToUserId: input.assignedToUserId || null,
        notes: input.notes ?? "",
        attachments: input.attachments ?? [],
        dueAt: computeDueAt(now, toDept.slaHours),
        createdBy: u.id,
        createdByName: u.name,
      })
      .returning()
    const ref = inserted[0]
    await tx.insert(referralEvent).values({
      organizationId: scope.organizationId,
      referralId: ref.id,
      actorId: u.id,
      actorName: u.name,
      action: "created",
      toStatus: "new",
      comment: input.notes ?? "",
    })
    return ref
  })

  revalidatePath("/departments")
  revalidatePath(`/departments/${toDept.code}`)
  return created
}

// انتقال حالة عام مع تسجيل الحدث. يفرض العزل والكتابة.
async function transition(
  referralId: number,
  action: string,
  toStatus: ReferralStatus,
  extra: {
    comment?: string
    patch?: Partial<typeof referral.$inferInsert>
    allowedFrom?: ReferralStatus[]
  } = {},
) {
  const scope = await requireModuleScope("departments")
  await assertWritable()
  const u = await requireUser()

  const rows = await db
    .select()
    .from(referral)
    .where(and(eq(referral.id, referralId), eq(referral.organizationId, scope.organizationId)))
    .limit(1)
  const ref = rows[0]
  if (!ref) throw new Error("الإحالة غير موجودة")
  if (extra.allowedFrom && !extra.allowedFrom.includes(ref.status as ReferralStatus)) {
    throw new Error("لا يمكن تنفيذ هذا الإجراء على الحالة الحالية للإحالة")
  }

  await db.transaction(async (tx) => {
    await tx
      .update(referral)
      .set({ status: toStatus, updatedAt: new Date(), ...(extra.patch ?? {}) })
      .where(and(eq(referral.id, referralId), eq(referral.organizationId, scope.organizationId)))
    await tx.insert(referralEvent).values({
      organizationId: scope.organizationId,
      referralId,
      actorId: u.id,
      actorName: u.name,
      action,
      fromStatus: ref.status,
      toStatus,
      comment: extra.comment ?? "",
    })
  })

  revalidatePath("/departments")
  const dept = await getDeptInOrg(scope.organizationId, ref.toDeptId)
  if (dept) revalidatePath(`/departments/${dept.code}`)
}

// استلام الإحالة (new → acknowledged).
export async function acknowledgeReferral(referralId: number) {
  await transition(referralId, "acknowledged", "acknowledged", {
    allowedFrom: ["new"],
    patch: { acknowledgedAt: new Date() },
  })
}

// إسناد الإحالة لمستخدم وبدء المعالجة.
export async function assignReferral(referralId: number, assignedToUserId: string, comment?: string) {
  await transition(referralId, "assigned", "in_progress", {
    comment,
    allowedFrom: ["new", "acknowledged", "returned"],
    patch: { assignedToUserId: assignedToUserId || null, acknowledgedAt: new Date() },
  })
}

// بدء المعالجة يدوياً (acknowledged → in_progress).
export async function startReferral(referralId: number, comment?: string) {
  await transition(referralId, "in_progress", "in_progress", {
    comment,
    allowedFrom: ["new", "acknowledged", "returned"],
    patch: { acknowledgedAt: new Date() },
  })
}

// إعادة الإحالة للمصدر مع سبب إلزامي.
export async function returnReferral(referralId: number, comment: string) {
  if (!comment?.trim()) throw new Error("سبب الإعادة مطلوب")
  await transition(referralId, "returned", "returned", {
    comment,
    allowedFrom: ["new", "acknowledged", "in_progress"],
  })
}

// إغلاق الإحالة مع ملاحظة/توقيع/مرفقات إغلاق.
export async function closeReferral(
  referralId: number,
  closure: { closureNote?: string; closureSignatureUrl?: string; attachments?: Attachment[] },
) {
  const u = await requireUser()
  await transition(referralId, "closed", "closed", {
    comment: closure.closureNote ?? "",
    allowedFrom: ["new", "acknowledged", "in_progress", "returned"],
    patch: {
      closureNote: closure.closureNote ?? "",
      closureSignatureUrl: closure.closureSignatureUrl ?? "",
      ...(closure.attachments ? { attachments: closure.attachments } : {}),
      closedAt: new Date(),
      closedBy: u.name,
    },
  })
}

// تصحيح: لا يُحذف أو يُعدَّل أي حدث سابق. التصحيح يُكتب كحدث جديد من نوع "correction"
// مع سبب إلزامي، دون تغيير حالة الإحالة — فيبقى خط السير سجلاً غير قابل للتلاعب.
export async function correctReferral(referralId: number, comment: string) {
  if (!comment?.trim()) throw new Error("سبب التصحيح مطلوب")
  const scope = await requireModuleScope("departments")
  await assertWritable()
  const u = await requireUser()
  const rows = await db
    .select({ status: referral.status, toDeptId: referral.toDeptId })
    .from(referral)
    .where(and(eq(referral.id, referralId), eq(referral.organizationId, scope.organizationId)))
    .limit(1)
  const ref = rows[0]
  if (!ref) throw new Error("الإحالة غير موجودة")
  await db.insert(referralEvent).values({
    organizationId: scope.organizationId,
    referralId,
    actorId: u.id,
    actorName: u.name,
    action: "correction",
    fromStatus: ref.status,
    toStatus: ref.status,
    comment,
  })
  const dept = await getDeptInOrg(scope.organizationId, ref.toDeptId)
  if (dept) revalidatePath(`/departments/${dept.code}`)
}

// إضافة تعليق دون تغيير الحالة.
export async function commentOnReferral(referralId: number, comment: string) {
  if (!comment?.trim()) throw new Error("التعليق فارغ")
  const scope = await requireModuleScope("departments")
  await assertWritable()
  const u = await requireUser()
  const rows = await db
    .select({ status: referral.status, toDeptId: referral.toDeptId })
    .from(referral)
    .where(and(eq(referral.id, referralId), eq(referral.organizationId, scope.organizationId)))
    .limit(1)
  const ref = rows[0]
  if (!ref) throw new Error("الإحالة غير موجودة")
  await db.insert(referralEvent).values({
    organizationId: scope.organizationId,
    referralId,
    actorId: u.id,
    actorName: u.name,
    action: "comment",
    fromStatus: ref.status,
    toStatus: ref.status,
    comment,
  })
  const dept = await getDeptInOrg(scope.organizationId, ref.toDeptId)
  if (dept) revalidatePath(`/departments/${dept.code}`)
}
