// حالات مسار الإحالة إلى الموارد البشرية للبنود الداخلية (مخالفات/حوادث).
export type HrStatus = "pending" | "in_review" | "closed"

export const hrStatusLabels: Record<HrStatus, string> = {
  pending: "بانتظار المعالجة",
  in_review: "قيد المراجعة",
  closed: "مغلقة",
}

export const hrStatusOptions: { value: HrStatus; label: string }[] = [
  { value: "pending", label: hrStatusLabels.pending },
  { value: "in_review", label: hrStatusLabels.in_review },
  { value: "closed", label: hrStatusLabels.closed },
]

/**
 * توحيد حالة HR للعرض. أي سجل داخلي قديم بدون hr_status (null/فارغ)
 * يُعتبر تلقائياً "pending" دون الحاجة لتعديل يدوي على البيانات القائمة.
 */
export function normalizeHrStatus(raw: string | null | undefined): HrStatus {
  if (raw === "in_review" || raw === "closed") return raw
  return "pending"
}

// يحلّل مرفقات قرار HR المخزّنة كـ JSON array من data URLs.
export function parseHrAttachments(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string" && x.length > 0) : []
  } catch {
    return []
  }
}
