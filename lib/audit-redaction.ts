import { getTableColumns, sql } from "drizzle-orm"
import { incident, violation } from "@/lib/db/schema"
import type { ModuleScope } from "@/lib/session"

// حجب بيانات الإجراءات التأديبية (الموارد البشرية) والتسويات المالية عن دور المدقق
// على مستوى الاستعلام: الأعمدة لا تُقرأ من قاعدة البيانات أصلاً، بل تُستبدل بقيم
// فارغة في جملة SELECT نفسها. النتيجة تبقى بنفس شكل الصف فلا يتأثر أي مستهلك،
// لكن القيمة الحقيقية لا تغادر قاعدة البيانات إطلاقاً (لا إخفاء على مستوى الواجهة).
//
// ما يبقى ظاهراً للمدقق عمداً: hrStatus و financeStatus (حالة المسار: هل عولج وأُغلق؟)
// والتواقيع الرسمية — فهي دليل اكتمال الإجراء لا مضمونه، وهي جوهر عمل التدقيق.

const REDACTED_TEXT = sql<string>`''`
const REDACTED_DATE = sql<null>`null`

// الأعمدة النصية الحسّاسة المشتركة بين جدولَي المخالفات والحوادث.
const SENSITIVE_TEXT = [
  "hrAction",
  "hrNotes",
  "hrAttachmentUrl",
  "hrClosedBy",
  "settlementNumber",
  "paymentReceiptUrl",
  "financeClosedBy",
  // يحمل نص قرار الموارد البشرية أو رقم التسوية عند الإغلاق.
  "closureAction",
] as const

// أعمدة التاريخ/الوقت الحسّاسة المقابلة لها.
const SENSITIVE_DATE = ["hrActionDate", "hrClosedAt", "financeClosedAt"] as const

function redact<T extends Record<string, unknown>>(cols: T): T {
  const out = { ...cols } as Record<string, unknown>
  for (const key of SENSITIVE_TEXT) if (key in out) out[key] = REDACTED_TEXT
  for (const key of SENSITIVE_DATE) if (key in out) out[key] = REDACTED_DATE
  return out as T
}

// أعمدة جدول المخالفات كما يُسمح لصاحب هذا النطاق بقراءتها.
export function violationColumns(scope: Pick<ModuleScope, "isAuditor">) {
  const cols = getTableColumns(violation)
  return scope.isAuditor ? redact(cols) : cols
}

// أعمدة جدول الحوادث كما يُسمح لصاحب هذا النطاق بقراءتها.
export function incidentColumns(scope: Pick<ModuleScope, "isAuditor">) {
  const cols = getTableColumns(incident)
  return scope.isAuditor ? redact(cols) : cols
}
