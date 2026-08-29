"use server"

import { db } from "@/lib/db"
import { orgSettings, vehicleType, violationType, inspectionCategory, organization } from "@/lib/db/schema"
import { eq, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireScope, requireHseReviewerScope } from "@/lib/session"
import { getSettingsLock, lockSettings, SETTINGS_LOCKED_MESSAGE } from "@/lib/settings-lock"
import {
  MAX_GATES,
  DEFAULT_ENTRY_GATE_COUNT,
  DEFAULT_EXIT_GATE_COUNT,
  DEFAULT_VEHICLE_TYPES,
  DEFAULT_VIOLATION_TYPES,
  DEFAULT_INSPECTION_CATEGORIES,
  type OperationalSettings,
  type OperationalSettingsInput,
  type Severity,
} from "@/lib/org-settings-shared"

function normSeverity(s: string): Severity {
  return s === "low" || s === "high" ? s : "medium"
}
function clampGate(n: unknown): number {
  const v = Math.trunc(Number(n))
  if (!Number.isFinite(v) || v < 1) return 1
  return Math.min(v, MAX_GATES)
}

// تهيئة القيم الافتراضية لمؤسسة جديدة عند تسجيلها. تُكتب مرة واحدة فقط (idempotent:
// لا تكرّر إن كانت هناك صفوف مسبقاً). تُستدعى من registerOrganization بعد إنشاء المؤسسة.
export async function seedOrganizationDefaults(organizationId: string): Promise<void> {
  const existing = await db
    .select({ organizationId: orgSettings.organizationId })
    .from(orgSettings)
    .where(eq(orgSettings.organizationId, organizationId))
    .limit(1)
  if (existing.length > 0) return

  await db.insert(orgSettings).values({
    organizationId,
    entryGateCount: DEFAULT_ENTRY_GATE_COUNT,
    exitGateCount: DEFAULT_EXIT_GATE_COUNT,
  })
  await db.insert(vehicleType).values(
    DEFAULT_VEHICLE_TYPES.map((label, i) => ({ organizationId, label, sortOrder: i })),
  )
  await db.insert(violationType).values(
    DEFAULT_VIOLATION_TYPES.map((v, i) => ({ organizationId, label: v.label, severity: v.severity, sortOrder: i })),
  )
  await db.insert(inspectionCategory).values(
    DEFAULT_INSPECTION_CATEGORIES.map((c, i) => ({
      organizationId,
      label: c.label,
      icon: c.icon,
      color: c.color,
      sortOrder: i,
    })),
  )
}

// يقرأ إعدادات التشغيل للمؤسسة الحالية. متاح لأي مستخدم مصادَق ضمن المؤسسة (قراءة).
// إن لم تكن هناك صفوف محفوظة (مؤسسة قائمة قبل الميزة) يعيد القيم الافتراضية كقيمة
// ظاهرية دون كتابة — يتم تثبيتها فعلياً عند أول حفظ.
export async function getOperationalSettings(): Promise<OperationalSettings> {
  const { organizationId } = await requireScope()

  const [general] = await db.select().from(orgSettings).where(eq(orgSettings.organizationId, organizationId)).limit(1)
  const vTypes = await db
    .select()
    .from(vehicleType)
    .where(eq(vehicleType.organizationId, organizationId))
    .orderBy(asc(vehicleType.sortOrder), asc(vehicleType.id))
  const violTypes = await db
    .select()
    .from(violationType)
    .where(eq(violationType.organizationId, organizationId))
    .orderBy(asc(violationType.sortOrder), asc(violationType.id))
  const cats = await db
    .select()
    .from(inspectionCategory)
    .where(eq(inspectionCategory.organizationId, organizationId))
    .orderBy(asc(inspectionCategory.sortOrder), asc(inspectionCategory.id))

  return {
    general: {
      entryGateCount: general ? general.entryGateCount : DEFAULT_ENTRY_GATE_COUNT,
      exitGateCount: general ? general.exitGateCount : DEFAULT_EXIT_GATE_COUNT,
    },
    vehicleTypes:
      vTypes.length > 0
        ? vTypes.map((r) => ({ id: r.id, label: r.label }))
        : DEFAULT_VEHICLE_TYPES.map((label, i) => ({ id: -(i + 1), label })),
    violationTypes:
      violTypes.length > 0
        ? violTypes.map((r) => ({ id: r.id, label: r.label, severity: normSeverity(r.severity) }))
        : DEFAULT_VIOLATION_TYPES.map((v, i) => ({ id: -(i + 1), label: v.label, severity: v.severity })),
    inspectionCategories:
      cats.length > 0
        ? cats.map((r) => ({ id: r.id, label: r.label, icon: r.icon, color: r.color }))
        : DEFAULT_INSPECTION_CATEGORIES.map((c, i) => ({ id: -(i + 1), label: c.label, icon: c.icon, color: c.color })),
  }
}

// قراءة خفيفة لأعداد بوابات الدخول/الخروج فقط (تُستخدم في واجهة تتبع المركبات).
export async function getOperationalGateCounts(): Promise<{ entryGateCount: number; exitGateCount: number }> {
  const { organizationId } = await requireScope()
  const [general] = await db.select().from(orgSettings).where(eq(orgSettings.organizationId, organizationId)).limit(1)
  return {
    entryGateCount: general ? general.entryGateCount : DEFAULT_ENTRY_GATE_COUNT,
    exitGateCount: general ? general.exitGateCount : DEFAULT_EXIT_GATE_COUNT,
  }
}

// حفظ إعدادات التشغيل: استبدال كامل لكل مجموعة ضمن المؤسسة. مقصور على مدير المؤسسة
// (admin/manager)، وممنوع أثناء وضع عرض مسؤول المنصّة (assertWritable).
export async function saveOperationalSettings(
  input: OperationalSettingsInput,
): Promise<{ ok: boolean; error?: string }> {
  // قفل الإعداد الأولي: مسؤول المنصّة (readOnly = وضع الدخول إلى المؤسسة) يتجاوز القفل
  // ويعدّل دائماً؛ مدير المؤسسة يُرفض حفظه على الخادم بعد القفل برسالة موحّدة.
  const { organizationId, isManager, readOnly } = await requireHseReviewerScope()
  if (!isManager) return { ok: false, error: "التعديل مقصور على مدير المؤسسة" }
  const isPlatformAdminActing = readOnly
  if (!isPlatformAdminActing) {
    const { locked } = await getSettingsLock(organizationId)
    if (locked) return { ok: false, error: SETTINGS_LOCKED_MESSAGE }
  }

  // تنقية المدخلات: إسقاط الفارغ، قصّ الطول، تحديد الأعداد ضمن الحدود.
  const vTypes = input.vehicleTypes
    .map((v) => ({ label: (v.label || "").trim().slice(0, 120) }))
    .filter((v) => v.label.length > 0)
  const violTypes = input.violationTypes
    .map((v) => ({ label: (v.label || "").trim().slice(0, 200), severity: normSeverity(v.severity) }))
    .filter((v) => v.label.length > 0)
  const cats = input.inspectionCategories
    .map((c) => ({
      label: (c.label || "").trim().slice(0, 120),
      icon: (c.icon || "clipboard-check").trim().slice(0, 60),
      color: (c.color || "blue").trim().slice(0, 30),
    }))
    .filter((c) => c.label.length > 0)

  if (vTypes.length === 0) return { ok: false, error: "أضف نوع مركبة واحداً على الأقل" }
  if (violTypes.length === 0) return { ok: false, error: "أضف نوع مخالفة واحداً على الأقل" }
  if (cats.length === 0) return { ok: false, error: "أضف فئة جولة واحدة على الأقل" }

  const entryGateCount = clampGate(input.general.entryGateCount)
  const exitGateCount = clampGate(input.general.exitGateCount)

  // upsert للأعداد العامة.
  await db
    .insert(orgSettings)
    .values({ organizationId, entryGateCount, exitGateCount })
    .onConflictDoUpdate({
      target: orgSettings.organizationId,
      set: { entryGateCount, exitGateCount, updatedAt: new Date() },
    })

  // استبدال كامل لكل قائمة (حذف ثم إدراج) ضمن المؤسسة فقط.
  await db.delete(vehicleType).where(eq(vehicleType.organizationId, organizationId))
  await db.insert(vehicleType).values(vTypes.map((v, i) => ({ organizationId, label: v.label, sortOrder: i })))

  await db.delete(violationType).where(eq(violationType.organizationId, organizationId))
  await db
    .insert(violationType)
    .values(violTypes.map((v, i) => ({ organizationId, label: v.label, severity: v.severity, sortOrder: i })))

  await db.delete(inspectionCategory).where(eq(inspectionCategory.organizationId, organizationId))
  await db
    .insert(inspectionCategory)
    .values(cats.map((c, i) => ({ organizationId, label: c.label, icon: c.icon, color: c.color, sortOrder: i })))

  // أول حفظ ناجح من مدير المؤسسة يقفل معلومات المنشأة وإعدادات التشغيل معاً.
  if (!isPlatformAdminActing) await lockSettings(organizationId)

  revalidatePath("/settings")
  revalidatePath("/ai-monitoring")
  revalidatePath("/violations")
  revalidatePath("/equipment")
  revalidatePath("/patrol")
  return { ok: true }
}

// طلب مدير المؤسسة فتح تعديل الإعدادات بعد قفلها. لا يفتح القفل مباشرة — يسجّل الطلب
// فقط ليظهر لمسؤول المنصّة في قائمة المؤسسات. مسؤول المنصّة لا يحتاجه (يتجاوز القفل).
export async function requestSettingsUnlock(): Promise<{ ok: boolean; error?: string }> {
  const { organizationId, isManager, readOnly } = await requireHseReviewerScope()
  if (readOnly) return { ok: false, error: "مسؤول المنصّة يعدّل الإعدادات مباشرة دون طلب" }
  if (!isManager) return { ok: false, error: "الطلب مقصور على مدير المؤسسة" }
  const { locked } = await getSettingsLock(organizationId)
  if (!locked) return { ok: false, error: "الإعدادات غير مقفلة" }
  await db
    .update(organization)
    .set({ settingsUnlockRequested: true, updatedAt: new Date() })
    .where(eq(organization.id, organizationId))
  revalidatePath("/settings")
  revalidatePath("/admin/organizations")
  return { ok: true }
}
