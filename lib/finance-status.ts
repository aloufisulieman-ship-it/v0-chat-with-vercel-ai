// حالات مسار الإحالة إلى المالية للمخالفات الخارجية.
export type FinanceStatus = "pending" | "in_review" | "closed"

export const financeStatusLabels: Record<FinanceStatus, string> = {
  pending: "بانتظار المعالجة",
  in_review: "قيد المراجعة",
  closed: "مغلقة",
}

export const financeStatusOptions: { value: FinanceStatus; label: string }[] = [
  { value: "pending", label: financeStatusLabels.pending },
  { value: "in_review", label: financeStatusLabels.in_review },
  { value: "closed", label: financeStatusLabels.closed },
]

/**
 * توحيد حالة المالية للعرض. أي مخالفة خارجية قديمة بدون finance_status (null/فارغ)
 * تُعتبر تلقائياً "pending" دون الحاجة لتعديل يدوي على البيانات القائمة.
 */
export function normalizeFinanceStatus(raw: string | null | undefined): FinanceStatus {
  if (raw === "in_review" || raw === "closed") return raw
  return "pending"
}
