"use server"

import { headers } from "next/headers"
import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { organization, user as userTable } from "@/lib/db/schema"

// يُستدعى مباشرةً بعد نجاح authClient.signUp.email (الذي يسجّل الدخول تلقائياً ويضبط
// الكوكي). يقرأ المستخدم الحالي من الجلسة، ينشئ مؤسسة جديدة، ويرقّي المُسجِّل إلى
// أول admin/approved لها. idempotent: إن كان للمستخدم مؤسسة بالفعل يعيد النجاح دون تكرار.
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
