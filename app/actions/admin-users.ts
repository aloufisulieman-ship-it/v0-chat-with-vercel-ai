"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user as userTable, account as accountTable, session as sessionTable, userAuditLog } from "@/lib/db/schema"
import { requireAdmin, assertWritable, type AppUser } from "@/lib/session"
import { and, count, desc, eq, ne, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { ACCOUNT_STATUSES, ASSIGNABLE_ROLES, type AccountStatus, type AssignableRole } from "@/lib/roles"

// ============================================================================
// إدارة المستخدمين (مدير المؤسسة فقط) — كل تعديل يُسجَّل في user_audit_log.
// قواعد الحماية الأساسية:
//  - لا يغيّر المدير دوره أو حالته أو كلمة مروره من هنا.
//  - لا يُنزَّل/يُوقَف آخر مدير مفعّل في المؤسسة (يمنع قفل المؤسسة).
//  - الإيقاف/الحظر يُنهي كل جلسات المستخدم فوراً.
// ============================================================================

export type AdminUserRow = {
  id: string
  name: string
  email: string
  role: string
  status: string
  accountStatus: string
  department: string
  permissions: string
  createdAt: Date
  lastLoginAt: Date | null
  lastLoginDevice: string
  activeSessions: number
}

export type AuditRow = {
  id: number
  actorName: string
  actorEmail: string
  targetEmail: string
  action: string
  field: string
  oldValue: string
  newValue: string
  note: string
  createdAt: Date
}

async function clientIp() {
  const h = await headers()
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || ""
}

async function audit(
  actor: AppUser,
  target: { id: string; email: string },
  entry: { action: string; field?: string; oldValue?: string; newValue?: string; note?: string },
) {
  await db.insert(userAuditLog).values({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    targetUserId: target.id,
    targetEmail: target.email,
    action: entry.action,
    field: entry.field ?? "",
    oldValue: entry.oldValue ?? "",
    newValue: entry.newValue ?? "",
    note: entry.note ?? "",
    ip: await clientIp(),
  })
}

// يُحمّل المستخدم الهدف داخل مؤسسة المدير فقط (عزل صارم).
async function loadTarget(admin: AppUser, userId: string) {
  const [row] = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      role: userTable.role,
      accountStatus: userTable.accountStatus,
      permissions: userTable.permissions,
    })
    .from(userTable)
    .where(and(eq(userTable.id, userId), eq(userTable.organizationId, admin.organizationId)))
    .limit(1)
  if (!row) throw new Error("المستخدم غير موجود في مؤسستك")
  return row
}

// عدد المدراء المفعّلين غير هذا المستخدم — لمنع قفل المؤسسة.
async function otherActiveAdmins(admin: AppUser, exceptUserId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(userTable)
    .where(
      and(
        eq(userTable.organizationId, admin.organizationId),
        eq(userTable.role, "admin"),
        eq(userTable.status, "approved"),
        eq(userTable.accountStatus, "active"),
        ne(userTable.id, exceptUserId),
      ),
    )
  return Number(r?.n ?? 0)
}

async function revokeSessions(userId: string) {
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId))
}

// ---------------------------------------------------------------------------

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const admin = await requireAdmin()
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      status: userTable.status,
      accountStatus: userTable.accountStatus,
      department: userTable.department,
      permissions: userTable.permissions,
      createdAt: userTable.createdAt,
      lastLoginAt: userTable.lastLoginAt,
      lastLoginDevice: userTable.lastLoginDevice,
      activeSessions: sql<number>`(select count(*)::int from "session" s where s."userId" = ${userTable.id} and s."expiresAt" > now())`,
    })
    .from(userTable)
    .where(eq(userTable.organizationId, admin.organizationId))
    .orderBy(desc(userTable.createdAt))
  return rows.map((r) => ({
    ...r,
    department: r.department ?? "",
    permissions: r.permissions ?? "",
    lastLoginDevice: r.lastLoginDevice ?? "",
    activeSessions: Number(r.activeSessions ?? 0),
  }))
}

export async function getUserAuditLog(limit = 100): Promise<AuditRow[]> {
  const admin = await requireAdmin()
  // نعرض فقط الأحداث التي تخص مستخدمي مؤسسة المدير.
  return db
    .select({
      id: userAuditLog.id,
      actorName: userAuditLog.actorName,
      actorEmail: userAuditLog.actorEmail,
      targetEmail: userAuditLog.targetEmail,
      action: userAuditLog.action,
      field: userAuditLog.field,
      oldValue: userAuditLog.oldValue,
      newValue: userAuditLog.newValue,
      note: userAuditLog.note,
      createdAt: userAuditLog.createdAt,
    })
    .from(userAuditLog)
    .innerJoin(userTable, eq(userTable.id, userAuditLog.targetUserId))
    .where(eq(userTable.organizationId, admin.organizationId))
    .orderBy(desc(userAuditLog.createdAt), desc(userAuditLog.id))
    .limit(limit)
    .then((rows) =>
      rows.map((r) => ({
        ...r,
        field: r.field ?? "",
        oldValue: r.oldValue ?? "",
        newValue: r.newValue ?? "",
        note: r.note ?? "",
      })),
    )
}

export async function setUserRole(userId: string, role: string): Promise<{ success?: true; error?: string }> {
  await assertWritable()
  const admin = await requireAdmin()
  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) return { error: "دور غير صالح" }
  if (userId === admin.id) return { error: "لا يمكنك تغيير دورك بنفسك" }

  const target = await loadTarget(admin, userId)
  if (target.role === role) return { success: true }
  if (target.role === "admin" && role !== "admin" && (await otherActiveAdmins(admin, userId)) === 0) {
    return { error: "لا يمكن تنزيل آخر مدير مفعّل في المؤسسة" }
  }

  await db.update(userTable).set({ role: role as AssignableRole, updatedAt: new Date() }).where(eq(userTable.id, userId))
  await audit(admin, target, { action: "role_change", field: "role", oldValue: target.role, newValue: role })
  revalidatePath("/admin/users")
  revalidatePath("/users")
  return { success: true }
}

export async function setAccountStatus(
  userId: string,
  status: string,
  note = "",
): Promise<{ success?: true; error?: string }> {
  await assertWritable()
  const admin = await requireAdmin()
  if (!(ACCOUNT_STATUSES as readonly string[]).includes(status)) return { error: "حالة غير صالحة" }
  if (userId === admin.id) return { error: "لا يمكنك تغيير حالة حسابك بنفسك" }

  const target = await loadTarget(admin, userId)
  if (target.accountStatus === status) return { success: true }
  if (status !== "active" && target.role === "admin" && (await otherActiveAdmins(admin, userId)) === 0) {
    return { error: "لا يمكن إيقاف آخر مدير مفعّل في المؤسسة" }
  }

  await db
    .update(userTable)
    .set({ accountStatus: status as AccountStatus, updatedAt: new Date() })
    .where(eq(userTable.id, userId))
  await audit(admin, target, {
    action: "account_status_change",
    field: "account_status",
    oldValue: target.accountStatus,
    newValue: status,
    note: note.trim(),
  })
  // الإيقاف/الحظر يسري فوراً: إنهاء كل جلسات المستخدم.
  if (status !== "active") {
    await revokeSessions(userId)
    await audit(admin, target, { action: "sessions_revoked", note: `بسبب: ${status}` })
  }
  revalidatePath("/admin/users")
  revalidatePath("/users")
  return { success: true }
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<{ success?: true; error?: string }> {
  await assertWritable()
  const admin = await requireAdmin()
  if (userId === admin.id) return { error: "غيّر كلمة مرورك من صفحة الحساب، لا من هنا" }
  if (!newPassword || newPassword.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }

  const target = await loadTarget(admin, userId)
  const ctx = await auth.$context
  const hash = await ctx.password.hash(newPassword)

  const updated = await db
    .update(accountTable)
    .set({ password: hash, updatedAt: new Date() })
    .where(and(eq(accountTable.userId, userId), eq(accountTable.providerId, "credential")))
    .returning({ id: accountTable.id })
  if (!updated[0]) return { error: "لا يوجد حساب بكلمة مرور لهذا المستخدم" }

  // إنهاء الجلسات القائمة حتى تُستخدم كلمة المرور الجديدة حصراً.
  await revokeSessions(userId)
  await audit(admin, target, { action: "password_reset", field: "password", note: "تمت إعادة التعيين من لوحة الإدارة" })
  revalidatePath("/admin/users")
  return { success: true }
}

export async function revokeUserSessions(userId: string): Promise<{ success?: true; error?: string }> {
  await assertWritable()
  const admin = await requireAdmin()
  const target = await loadTarget(admin, userId)
  await revokeSessions(userId)
  await audit(admin, target, { action: "sessions_revoked", note: "يدوياً من لوحة الإدارة" })
  revalidatePath("/admin/users")
  return { success: true }
}
