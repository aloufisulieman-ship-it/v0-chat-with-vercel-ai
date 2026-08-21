// إعدادات نظام التعرّف متعدد الأوضاع لكاميرا الهاتف (المراقبة الذكية).
// يضيف ثلاثة أوضاع تعرّف بصري إلى جانب كشف المخالفات القائم:
//   - plate: قراءة لوحات المركبات (نمط عُماني: أرقام + رمز حرفي عربي).
//   - employee_id: قراءة الرقم الوظيفي المطبوع على زيّ العامل من الخلف.
//   - tuktuk: قراءة رقم مركبة التوك توك المطبوع على الهيكل (رقمي غالباً).
// وضع «المخالفات» (violations) هو الوضع الأصلي ويبقى كما هو.

export type RecognitionMode = "violations" | "plate" | "employee_id" | "tuktuk"

export const RECOGNITION_MODES: RecognitionMode[] = ["violations", "plate", "employee_id", "tuktuk"]

// أوضاع الهوية (تُطابَق ضدّ سجلات مرجعية) مقابل وضع المخالفات.
export const IDENTITY_MODES: RecognitionMode[] = ["plate", "employee_id", "tuktuk"]

export function isRecognitionMode(v: unknown): v is RecognitionMode {
  return typeof v === "string" && (RECOGNITION_MODES as string[]).includes(v)
}

// حالة مطابقة تصريح التوك توك.
export type PermitMatchStatus = "valid" | "expired" | "not_found"

// عتبة الثقة التي نعتبر عندها القراءة موثوقة بما يكفي للتخزين/المطابقة/التعبئة التلقائية.
export const HIGH_CONFIDENCE = 75
// أدنى ثقة نخزّن عندها القراءة أصلاً (نتجاهل التخمينات الضعيفة جداً).
export const MIN_STORE_CONFIDENCE = 40

// تطبيع قيمة نصّية للمطابقة: إزالة المسافات والرموز والحروف الصغيرة/الكبيرة.
export function normalizeCode(value: string): string {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.]/g, "")
}

// توحيد نسبة الثقة إلى عدد صحيح 0-100 (بعض النماذج تُعيدها ككسر 0-1).
export function normalizeConfidence(raw: number | undefined | null): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0
  const scaled = n <= 1 ? n * 100 : n
  return Math.max(0, Math.min(100, Math.round(scaled)))
}
