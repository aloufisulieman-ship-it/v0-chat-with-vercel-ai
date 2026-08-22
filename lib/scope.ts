import { and, eq, type SQL } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import type { ModuleScope } from "@/lib/session"

// يبني شرط العزل الموحّد لأي جدول تشغيلي:
//   - دائماً: organizationId = مؤسسة صاحب الجلسة (عزل صارم بين المؤسسات، لا يُخترق).
//   - إن لم يكن المستخدم مديراً داخل مؤسسته: يُضاف userId = هويته (يرى/يعدّل سجلاته فقط).
//   - extra: شرط إضافي اختياري (مثل eq(table.id, id) في التعديل/الحذف، أو فلتر نوع).
//
// يُستخدم في كل SELECT/UPDATE/DELETE بحيث يستحيل قراءة أو تعديل صف خارج المؤسسة،
// وداخل المؤسسة يبقى الفصل بين المدير والموظف كما هو معتمد.
export function scopeWhere(
  cols: { organizationId: AnyPgColumn; userId: AnyPgColumn },
  scope: ModuleScope,
  extra?: SQL,
): SQL {
  const parts: (SQL | undefined)[] = [eq(cols.organizationId, scope.organizationId)]
  if (!scope.isManager) parts.push(eq(cols.userId, scope.userId))
  if (extra) parts.push(extra)
  return and(...parts) as SQL
}

// نسخة مبسّطة للجداول التي لا تُفصَل داخلياً بالمالك (تُرى لكل أعضاء المؤسسة)،
// حيث يكفي العزل بالمؤسسة فقط. تُستخدم للجداول المشتركة على مستوى المؤسسة.
export function orgWhere(organizationIdCol: AnyPgColumn, scope: ModuleScope, extra?: SQL): SQL {
  const base = eq(organizationIdCol, scope.organizationId)
  return (extra ? and(base, extra) : base) as SQL
}
