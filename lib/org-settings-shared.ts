// ---------- أنواع وقيم افتراضية لإعدادات التشغيل لكل مؤسسة ----------
// هذه القيم كانت مثبّتة في الكود وأصبحت قابلة للتخصيص لكل مؤسسة عبر جداول
// org_settings / vehicle_types / violation_types / inspection_categories.
// تُستخدم القوائم الافتراضية أدناه لتعبئة المؤسسات الجديدة، وكقيمة ظاهرية للمؤسسات
// القائمة التي لم تُخصّص إعداداتها بعد (دون كتابة في قاعدة البيانات).

export type Severity = "low" | "medium" | "high"

// الحدّ الأعلى لعدد البوابات المسموح في الواجهة (لكل اتجاه).
export const MAX_GATES = 12

export type OrgGeneralSettings = {
  entryGateCount: number
  exitGateCount: number
}

export type VehicleTypeItem = { id: number; label: string }
export type ViolationTypeItem = { id: number; label: string; severity: Severity }
export type InspectionCategoryItem = {
  id: number
  label: string
  icon: string
  color: string
}

export type OperationalSettings = {
  general: OrgGeneralSettings
  vehicleTypes: VehicleTypeItem[]
  violationTypes: ViolationTypeItem[]
  inspectionCategories: InspectionCategoryItem[]
}

// مدخلات الحفظ (بلا معرّفات — استبدال كامل لكل مجموعة ضمن المؤسسة).
export type OperationalSettingsInput = {
  general: OrgGeneralSettings
  vehicleTypes: { label: string }[]
  violationTypes: { label: string; severity: Severity }[]
  inspectionCategories: { label: string; icon: string; color: string }[]
}

/* ---------------- مجموعة الأيقونات والألوان المتاحة لفئات الجولة ---------------- */
// أسماء أيقونات lucide-react التي تعرضها الواجهة في مُنتقي الأيقونة.
export const CATEGORY_ICON_CHOICES = [
  "truck",
  "forklift",
  "users",
  "person-standing",
  "footprints",
  "hard-hat",
  "shield-alert",
  "clipboard-check",
  "flame",
  "droplet",
  "construction",
  "traffic-cone",
] as const
export type CategoryIcon = (typeof CATEGORY_ICON_CHOICES)[number]

// ألوان دلالية معرّفة كرموز hex ثابتة (لون النص + خلفية فاتحة) لعرض الفئات.
export const CATEGORY_COLOR_CHOICES: { value: string; color: string; bg: string }[] = [
  { value: "red", color: "#dc2626", bg: "#fef2f2" },
  { value: "violet", color: "#7c3aed", bg: "#f5f3ff" },
  { value: "amber", color: "#d97706", bg: "#fffbeb" },
  { value: "sky", color: "#0284c7", bg: "#f0f9ff" },
  { value: "green", color: "#059669", bg: "#f0fdf4" },
  { value: "yellow", color: "#b45309", bg: "#fefce8" },
  { value: "gray", color: "#6b7280", bg: "#f9fafb" },
  { value: "blue", color: "#2563eb", bg: "#eff6ff" },
]

export function categoryColorStyle(value: string): { color: string; bg: string } {
  return CATEGORY_COLOR_CHOICES.find((c) => c.value === value) ?? CATEGORY_COLOR_CHOICES[7]
}

export const SEVERITY_CHOICES: { value: Severity; labelAr: string }[] = [
  { value: "low", labelAr: "منخفضة" },
  { value: "medium", labelAr: "متوسطة" },
  { value: "high", labelAr: "عالية" },
]

/* ---------------- القيم الافتراضية (تُطابق ما كان مثبّتاً في الكود) ---------------- */

export const DEFAULT_ENTRY_GATE_COUNT = 1
export const DEFAULT_EXIT_GATE_COUNT = 1

export const DEFAULT_VEHICLE_TYPES: string[] = [
  "رافعة شوكية",
  "توك توك",
  "شاحنة",
  "رافعة",
  "أخرى",
]

export const DEFAULT_VIOLATION_TYPES: { label: string; severity: Severity }[] = [
  { label: "عدم ارتداء خوذة السلامة", severity: "high" },
  { label: "عدم ارتداء حذاء السلامة", severity: "medium" },
  { label: "عدم ارتداء سترة عاكسة", severity: "medium" },
  { label: "عدم ارتداء قفازات واقية", severity: "medium" },
  { label: "عدم ارتداء نظارات واقية", severity: "medium" },
  { label: "عدم ارتداء كمامة أو جهاز تنفس", severity: "medium" },
  { label: "عدم ارتداء حزام الأمان للعمل على الارتفاع", severity: "high" },
  { label: "العمل بدون تصريح عمل", severity: "high" },
  { label: "تجاوز منطقة العمل المحددة", severity: "medium" },
  { label: "مخالفة إجراءات العزل والقفل (LOTO)", severity: "high" },
  { label: "استخدام معدات تالفة أو غير مطابقة", severity: "high" },
  { label: "تشغيل معدات بدون تدريب أو ترخيص", severity: "high" },
  { label: "الإهمال في تأمين منطقة العمل", severity: "medium" },
  { label: "عدم الإبلاغ عن حادثة أو إصابة", severity: "high" },
  { label: "إهمال نظافة موقع العمل", severity: "low" },
  { label: "عدم التخلص الصحيح من النفايات", severity: "medium" },
  { label: "سد مخارج الطوارئ أو ممرات الإخلاء", severity: "high" },
  { label: "تخزين مواد بطريقة غير آمنة", severity: "medium" },
  { label: "التشتت أو استخدام الهاتف أثناء العمل", severity: "medium" },
  { label: "الإهمال المتعمد في اتباع تعليمات السلامة", severity: "high" },
  { label: "التدخين في مناطق محظورة", severity: "high" },
  { label: "السير في مسارات المركبات", severity: "medium" },
  { label: "التصرف بصورة عدوانية أو غير لائقة", severity: "medium" },
  { label: "قيادة مركبة بسرعة زائدة داخل الموقع", severity: "high" },
  { label: "عدم ارتداء حزام الأمان في المركبة", severity: "medium" },
  { label: "استخدام الجوال أثناء القيادة", severity: "high" },
  { label: "إهمال صيانة المركبة أو المعدة", severity: "medium" },
  { label: "التعامل مع مواد خطرة بدون مؤهل", severity: "high" },
  { label: "عدم الالتزام بتعليمات بطاقة MSDS", severity: "medium" },
  { label: "تسريب مواد كيميائية دون إبلاغ", severity: "high" },
  { label: "مخالفة أخرى", severity: "medium" },
]

export const DEFAULT_INSPECTION_CATEGORIES: { label: string; icon: CategoryIcon; color: string }[] = [
  { label: "الرافعات الشوكية", icon: "truck", color: "red" },
  { label: "التوك توك", icon: "truck", color: "violet" },
  { label: "التحميل والتفريغ", icon: "users", color: "amber" },
  { label: "السترات العاكسة", icon: "person-standing", color: "sky" },
  { label: "معابر المشاة", icon: "footprints", color: "green" },
  { label: "أحذية السلامة", icon: "hard-hat", color: "yellow" },
  { label: "أخرى", icon: "shield-alert", color: "gray" },
]

// الإعدادات الافتراضية الكاملة كقيمة ظاهرية (معرّفات سالبة مؤقتة للعرض فقط).
export function defaultOperationalSettings(): OperationalSettings {
  return {
    general: { entryGateCount: DEFAULT_ENTRY_GATE_COUNT, exitGateCount: DEFAULT_EXIT_GATE_COUNT },
    vehicleTypes: DEFAULT_VEHICLE_TYPES.map((label, i) => ({ id: -(i + 1), label })),
    violationTypes: DEFAULT_VIOLATION_TYPES.map((v, i) => ({ id: -(i + 1), ...v })),
    inspectionCategories: DEFAULT_INSPECTION_CATEGORIES.map((c, i) => ({ id: -(i + 1), ...c })),
  }
}
