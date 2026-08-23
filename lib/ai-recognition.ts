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

// خريطة الأرقام العربية/الهندية إلى الإنجليزية لتوحيد القراءة والإدخال.
const ARABIC_INDIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
}

// تحويل الحروف العربية الشائعة في رموز اللوحات العُمانية إلى مقابلها اللاتيني،
// حتى تتطابق "ي ر" مع "YR" سواء أُدخلت اللوحة بالعربي أو الإنجليزي في السجل.
const ARABIC_LETTER_TO_LATIN: Record<string, string> = {
  ا: "A", أ: "A", إ: "A", آ: "A", ب: "B", ت: "T", ث: "TH", ج: "J", ح: "H",
  خ: "KH", د: "D", ذ: "DH", ر: "R", ز: "Z", س: "S", ش: "SH", ص: "S", ض: "D",
  ط: "T", ظ: "Z", ع: "A", غ: "GH", ف: "F", ق: "Q", ك: "K", ل: "L", م: "M",
  ن: "N", ه: "H", ة: "H", و: "W", ي: "Y", ى: "Y", ئ: "Y", ء: "A",
}

// تطبيع رقم اللوحة العُمانية للمطابقة: يوحّد الأرقام العربية/الإنجليزية، ويحوّل رمز
// الحروف العربي إلى لاتيني، ثم يفصل الأرقام عن الحروف ويعيد ترتيبها بشكل قانوني
// (الحروف ثم الأرقام) بحيث تتطابق "3072 ي ر" و"YR 3072" و"yr3072" كلها معاً،
// مع بقاء لوحة برمز حروف مختلف (مثل "3072 ب ب") مختلفةً عنها.
export function normalizePlate(value: string): string {
  let s = (value || "").toString().trim().toUpperCase()
  // توحيد الأرقام العربية/الهندية إلى إنجليزية.
  s = s.replace(/[٠-٩۰-۹]/g, (d) => ARABIC_INDIC_DIGITS[d] ?? d)
  // تحويل الحروف العربية إلى لاتينية.
  s = s.replace(/[\u0600-\u06FF]/g, (ch) => ARABIC_LETTER_TO_LATIN[ch] ?? "")
  // فصل الأرقام والحروف اللاتينية فقط (حذف المسافات والرموز الأخرى).
  const digits = (s.match(/[0-9]+/g) || []).join("")
  const letters = (s.match(/[A-Z]+/g) || []).join("")
  // ترتيب قانوني موحّد: الحروف ثم الأرقام، حتى لا يؤثّر ترتيب الإدخال على المطابقة.
  return `${letters}${digits}`
}

// توحيد نسبة الثقة إلى عدد صحيح 0-100 (بعض النماذج تُعيدها ككسر 0-1).
export function normalizeConfidence(raw: number | undefined | null): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0
  const scaled = n <= 1 ? n * 100 : n
  return Math.max(0, Math.min(100, Math.round(scaled)))
}
