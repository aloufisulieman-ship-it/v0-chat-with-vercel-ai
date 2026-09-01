import { db } from "@/lib/db"
import { attachment } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { roleKindFor } from "@/lib/signature-roles"

// التحقق من وجود توقيع دور معيّن على سجل.
// عند تمرير userId يُقيَّد البحث بالموقِّع نفسه ليطابق نطاق العرض (وسيط /api/file
// المقيّد بالمستخدم/المؤسسة) ونطاق الرفع؛ فالموظف الذي يوقّع هو نفسه من يُغلق،
// ويظل التوقيع المعروض في البطاقة متطابقاً مع ما يفرضه شرط الإغلاق. وبدون userId
// يبقى التحقق على مستوى المؤسسة فقط (توافق خلفي).
export async function hasRoleSignature(params: {
  organizationId: string
  module: string
  recordId: number
  roleKey: string
  userId?: string
}): Promise<boolean> {
  const { organizationId, module, recordId, roleKey, userId } = params
  const rows = await db
    .select({ id: attachment.id })
    .from(attachment)
    .where(
      and(
        eq(attachment.organizationId, organizationId),
        eq(attachment.module, module),
        eq(attachment.recordId, recordId),
        eq(attachment.kind, roleKindFor(roleKey)),
        ...(userId ? [eq(attachment.userId, userId)] : []),
      ),
    )
    .limit(1)
  return rows.length > 0
}
