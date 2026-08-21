// إعدادات نظام الترجمة المركزي (i18n): اللغات المدعومة، الاتجاه، والتنسيقات.
// نظام مخصّص خفيف بلا مكتبات خارجية — يعمل مع Server Components والكوكي وقاعدة البيانات.

export const locales = ["ar", "en"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "ar"

// اسم الكوكي الذي يحفظ تفضيل اللغة (مطابق في الخادم والعميل).
export const LOCALE_COOKIE = "app_locale"

// اتجاه الكتابة لكل لغة — يُطبّق على وسم <html dir=...>.
export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
}

// وسم BCP-47 للغة (يُستخدم في <html lang=...> وفي تنسيق الأرقام/التواريخ).
export const localeBcp47: Record<Locale, string> = {
  ar: "ar-SA",
  en: "en-US",
}

// الاسم المعروض لكل لغة في قائمة الاختيار (كل لغة باسمها الأصلي).
export const localeLabels: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
}

// تحقّق آمن من أن قيمة نصية هي لغة مدعومة، وإلا نعيد الافتراضية.
export function normalizeLocale(value: string | undefined | null): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : defaultLocale
}
