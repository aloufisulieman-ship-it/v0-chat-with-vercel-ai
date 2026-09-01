import { db } from "@/lib/db"
import { attachment } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { roleKindFor } from "@/lib/signature-roles"

// التحقق من وجود توقيع دور معيّن على سجل، على مستوى المؤسسة.
// النطاق بالمؤسسة (وليس بالمستخدم) لأن التوقيع خاصية للمخالفة نفسها: أي موظف
// مخوّل في المؤسسة قد يوقّع، والتحقق يجب أن يراه بصرف النظر عن من يغلق السجل.
export async function hasRoleSignature(params: {
  organizationId: string
  module: string
  recordId: number
  roleKey: string
}): Promise<boolean> {
  const { organizationId, module, recordId, roleKey } = params
  const rows = await db
    .select({ id: attachment.id })
    .from(attachment)
    .where(
      and(
        eq(attachment.organizationId, organizationId),
        eq(attachment.module, module),
        eq(attachment.recordId, recordId),
        eq(attachment.kind, roleKindFor(roleKey)),
      ),
    )
    .limit(1)
  return rows.length > 0
}
