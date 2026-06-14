export type ViolationCategory = "internal" | "external"

// كلمات مفتاحية تدل على مخالفة خارجية (شركة مقاولة / زائر / دخول الموقع).
const EXTERNAL_KEYWORDS = [
  "اشتراطات الدخول",
  "لوائح الموقع",
  "مقاول",
  "زائر",
  "تصريح دخول",
  "بدون تصريح",
  "تجاوز منطقة العمل",
]

// يحدد التصنيف تلقائياً بناءً على نوع المخالفة المختار.
export function classifyViolation(type: string): ViolationCategory {
  if (EXTERNAL_KEYWORDS.some((k) => type.includes(k))) return "external"
  return "internal"
}

export const categoryLabels: Record<string, string> = {
  internal: "داخلية",
  external: "خارجية",
}

export const categoryOptions = [
  { value: "internal", label: "داخلية (موظف)" },
  { value: "external", label: "خارجية (شركة مقاولة / زائر)" },
]

// خيارات الإجراء الداخلي حسب التصنيف.
export const internalActionOptions: Record<ViolationCategory, { value: string; label: string }[]> = {
  internal: [{ value: "تحويل إلى الموارد البشرية", label: "تحويل إلى الموارد البشرية" }],
  external: [
    { value: "إشعار الشركة", label: "إشعار الشركة" },
    { value: "إيقاف العمل", label: "إيقاف العمل" },
  ],
}
