import { normalizeHrStatus } from "@/lib/hr-status"
import { normalizeFinanceStatus } from "@/lib/finance-status"

// الحد الأدنى من الحقول اللازمة لحساب الحالة الفعلية للمخالفة.
type ViolationStatusInput = {
  category?: string | null
  status?: string | null
  hrStatus?: string | null
  financeStatus?: string | null
}

/**
 * الحالة الرئيسية الفعلية للمخالفة.
 *
 * تُحسب اشتقاقاً (عند التحميل) لتجنب تعارض حقل status المخزّن — الذي يعكس فقط
 * إغلاق الإجراء الداخلي الفوري — مع حالة مسار الإحالة الحقيقي:
 *  - المخالفة الداخلية: مغلقة فقط عندما تُغلق الموارد البشرية القضية (hrStatus=closed)،
 *    وإلا فهي "قيد المعالجة" مهما كان الإجراء الداخلي الفوري.
 *  - المخالفة الخارجية: نفس المنطق لكن بناءً على حالة المالية (financeStatus=closed).
 *  - بدون تصنيف (لا تحويل مطلوب): تُستخدم قيمة status المخزّنة كما هي.
 *
 * لا تُعدّل أي بيانات مخزّنة؛ الحساب اشتقاقي فقط فيسري فوراً على كل السجلات.
 */
export function effectiveViolationStatus(v: ViolationStatusInput): string {
  if (v.category === "internal") {
    return normalizeHrStatus(v.hrStatus) === "closed" ? "closed" : "in_progress"
  }
  if (v.category === "external") {
    return normalizeFinanceStatus(v.financeStatus) === "closed" ? "closed" : "in_progress"
  }
  return v.status ?? "open"
}

// هل المخالفة مغلقة فعلياً (وفق مسار الإحالة)؟
export function isViolationClosed(v: ViolationStatusInput): boolean {
  return effectiveViolationStatus(v) === "closed"
}
