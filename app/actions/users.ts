"use server"

import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/session"
import { and, desc, eq, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getUsers() {
  await requireAdmin()
  return db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      status: userTable.status,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .orderBy(desc(userTable.createdAt))
}

export async function approveUser(id: string) {
  await requireAdmin()
  await db.update(userTable).set({ status: "approved", updatedAt: new Date() }).where(eq(userTable.id, id))
  revalidatePath("/users")
}

export async function rejectUser(id: string) {
  const admin = await requireAdmin()
  // Cannot reject yourself.
  if (id === admin.id) return
  await db
    .update(userTable)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(userTable.id, id), ne(userTable.id, admin.id)))
  revalidatePath("/users")
}

export async function setUserRole(id: string, role: "admin" | "manager" | "user") {
  const admin = await requireAdmin()
  // Cannot change your own role (avoid locking yourself out of admin).
  if (id === admin.id) return
  await db
    .update(userTable)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(userTable.id, id), ne(userTable.id, admin.id)))
  revalidatePath("/users")
}

export async function deleteUser(id: string) {
  const admin = await requireAdmin()
  if (id === admin.id) return
  await db.delete(userTable).where(and(eq(userTable.id, id), ne(userTable.id, admin.id)))
  revalidatePath("/users")
}
