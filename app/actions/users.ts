"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user as userTable, account as accountTable } from "@/lib/db/schema"
import { requireAdmin, assertWritable } from "@/lib/session"
import { and, desc, eq, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { serializePermissions } from "@/lib/permissions"

export async function getUsers() {
  const admin = await requireAdmin()
  return db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      status: userTable.status,
      department: userTable.department,
      permissions: userTable.permissions,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .where(eq(userTable.organizationId, admin.organizationId))
    .orderBy(desc(userTable.createdAt))
}

export async function createUser(input: {
  name: string
  email: string
  password: string
  role: "admin" | "manager" | "user"
  department: string
  permissions: string[]
}): Promise<{ success?: true; error?: string }> {
  await assertWritable()
  const admin = await requireAdmin()

  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name) return { error: "الاسم مطلوب" }
  if (!email || !email.includes("@")) return { error: "البريد الإلكتروني غير صالح" }
  if (!input.password || input.password.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }

  const existing = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, email)).limit(1)
  if (existing[0]) return { error: "هذا البريد الإلكتروني مستخدم بالفعل" }

  try {
    const ctx = await auth.$context
    const hash = await ctx.password.hash(input.password)
    const created = await ctx.internalAdapter.createUser({ name, email, emailVerified: false })
    const userId = created.id

    // العضو الجديد ينضم إلى مؤسسة المدير مباشرةً (approved) بالدور/القسم/الصلاحيات المختارة.
    await db
      .update(userTable)
      .set({
        name,
        role: input.role,
        status: "approved",
        organizationId: admin.organizationId,
        department: input.department,
        permissions: serializePermissions(input.permissions),
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, userId))

    // Credential account holding the hashed password (Better Auth email/password format).
    await db.insert(accountTable).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hash,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    revalidatePath("/users")
    return { success: true }
  } catch (e) {
    console.log("[v0] createUser error:", e instanceof Error ? e.message : String(e))
    return { error: "تعذّر إنشاء المستخدم. حاول مرة أخرى." }
  }
}

// Update a user's department and module permissions (admin only).
export async function updateUserPermissions(userId: string, department: string, permissions: string[]) {
  await assertWritable()
  const admin = await requireAdmin()
  await db
    .update(userTable)
    .set({
      department,
      permissions: serializePermissions(permissions),
      updatedAt: new Date(),
    })
    .where(and(eq(userTable.id, userId), eq(userTable.organizationId, admin.organizationId)))
  revalidatePath("/users")
}

export async function approveUser(id: string) {
  await assertWritable()
  const admin = await requireAdmin()
  await db
    .update(userTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(eq(userTable.id, id), eq(userTable.organizationId, admin.organizationId)))
  revalidatePath("/users")
}

export async function rejectUser(id: string) {
  await assertWritable()
  const admin = await requireAdmin()
  if (id === admin.id) return
  await db
    .update(userTable)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(userTable.id, id), ne(userTable.id, admin.id), eq(userTable.organizationId, admin.organizationId)))
  revalidatePath("/users")
}

export async function setUserRole(id: string, role: "admin" | "manager" | "user") {
  await assertWritable()
  const admin = await requireAdmin()
  // Cannot change your own role (avoid locking yourself out of admin).
  if (id === admin.id) return
  await db
    .update(userTable)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(userTable.id, id), ne(userTable.id, admin.id), eq(userTable.organizationId, admin.organizationId)))
  revalidatePath("/users")
}

export async function deleteUser(id: string) {
  await assertWritable()
  const admin = await requireAdmin()
  if (id === admin.id) return
  await db
    .delete(userTable)
    .where(and(eq(userTable.id, id), ne(userTable.id, admin.id), eq(userTable.organizationId, admin.organizationId)))
  revalidatePath("/users")
}
