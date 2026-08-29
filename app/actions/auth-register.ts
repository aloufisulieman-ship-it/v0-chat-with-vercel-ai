"use server"

import { headers } from "next/headers"
import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { organization, user as userTable, account as accountTable, session as sessionTable } from "@/lib/db/schema"
import { seedOrganizationDefaults } from "@/app/actions/org-settings"

// يحذف حساب المُسجِّل الحالي بالكامل (المستخدم + بيانات الاعتماد + الجلسات) عندما يفشل
// ربطه بمؤسسة صالحة، حتى لا يتبقّى حساب يتيم ويُحرَّر بريده لإعادة المحاولة.
async function deleteOrphanUser(userId: string): Promise<void> {
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId))
  await db.delete(accountTable).where(eq(accountTable.userId, userId))
  await db.delete(userTable).where(eq(userTable.id, userId))
}

// انضمام مستخدم جديد إلى مؤسسة معتمدة موجودة. يُستدعى مباشرةً بعد نجاح
// authClient.signUp.email (الذي يسجّل الدخول تلقائياً ويضبط الكوكي). يتحقق على الخادم
// أن المؤسسة المختارة موجودة ومعتمدة فعلاً — دفاعاً في العمق حتى لو تلاعب أحد بالنموذج.
// ينضم العضو بدور "user" وحالة "pending"، فيبقى محجوباً حتى يعتمده مدير مؤسسته.
export async function joinOrganization(input: {
  organizationId?: string
}): Promise<{ success?: true; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: "تعذّر إنشاء الجلسة. أعد المحاولة." }
  const userId = session.user.id

  // idempotent: إن كان للمستخدم مؤسسة بالفعل (إعادة إرسال) نعيد النجاح دون تكرار.
  const [me] = await db
    .select({ organizationId: userTable.organizationId })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
  if (!me) return { error: "المستخدم غير موجود" }
  if (me.organizationId) return { success: true }

  const orgId = (input.organizationId || "").trim()
  const [org] = orgId
    ? await db
        .select({ id: organization.id, status: organization.status })
        .from(organization)
        .where(eq(organization.id, orgId))
        .limit(1)
    : []

  // مؤسسة غير موجودة أو غير معتمدة بعد: نمنع الدخول ونحذف الحساب اليتيم.
  if (!org || org.status !== "approved") {
    await deleteOrphanUser(userId)
    return {
      error:
        "مؤسستك غير مسجّلة بعد في النظام. يرجى اختيار مؤسسة معتمدة من القائمة، أو التواصل معنا لتسجيل مؤسستكم أولاً.",
    }
  }

  // العضو ينضم إلى المؤسسة المعتمدة بدور عادي وبحالة "قيد المراجعة" حتى يعتمده مدير
  // مؤسسته من صفحة إدارة المستخدمين — لا يرى أي بيانات قبل ذلك (يحجبه requireUser).
  await db
    .update(userTable)
    .set({
      organizationId: org.id,
      role: "user",
      status: "pending",
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId))

  return { success: true }
}

// طلب تسجيل مؤسسة جديدة. يُستدعى مباشرةً بعد نجاح authClient.signUp.email من نموذج
// "طلب تسجيل مؤسسة". ينشئ مؤسسة جديدة بحالة "قيد المراجعة" ويرقّي المُسجِّل إلى أول
// admin لها (بحالة معلّقة) — يظهر الطلب في قائمة /admin/organizations لمسؤول المنصّة
// لاعتماده يدوياً. لا يُنشأ أي شيء تلقائياً من نموذج التسجيل العادي.
export async function registerOrganization(input: {
  companyName?: string
}): Promise<{ success?: true; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: "تعذّر إنشاء الجلسة. أعد المحاولة." }
  const userId = session.user.id

  // إن كان المستخدم مُرحَّلاً/مُهيّأً مسبقاً فلا نكرر الإنشاء.
  const existing = await db
    .select({ organizationId: userTable.organizationId, name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
  const row = existing[0]
  if (!row) return { error: "المستخدم غير موجود" }
  if (row.organizationId) return { success: true }

  const orgName =
    (input.companyName || "").trim() ||
    (row.name || "").trim() ||
    (row.email ? row.email.split("@")[0] : "") ||
    "مؤسستي"

  const orgId = randomUUID()
  // المؤسسة الجديدة تبدأ "قيد المراجعة" حتى يعتمدها مسؤول المنصّة.
  await db.insert(organization).values({
    id: orgId,
    name: orgName.slice(0, 200),
    status: "pending",
  })

  // تهيئة إعدادات التشغيل الافتراضية (أنواع مركبات/مخالفات، فئات جولة، أعداد بوابات).
  await seedOrganizationDefaults(orgId)

  // المُسجِّل يصبح أول admin لمؤسسته، لكن بحالة "قيد المراجعة" — لا يستطيع استخدام
  // النظام حتى يعتمد مسؤول المنصّة المؤسسة (عندها تتحوّل حالته إلى approved).
  await db
    .update(userTable)
    .set({
      organizationId: orgId,
      role: "admin",
      status: "pending",
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId))

  return { success: true }
}
