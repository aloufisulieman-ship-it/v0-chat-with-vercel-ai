// نواة الترجمة المشتركة (تعمل في الخادم والعميل): جلب القاموس، دالة t()،
// وأدوات تنسيق الأرقام والتواريخ حسب اللغة.

import { ar, type Dictionary } from "./dictionaries/ar"
import { en } from "./dictionaries/en"
import { type Locale, localeBcp47, defaultLocale, APP_TIME_ZONE } from "./config"

const dictionaries: Record<Locale, Dictionary> = { ar, en }

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale]
}

// دالة الترجمة: تقبل مسارًا بنقاط مثل "violations.title" وتُرجع النص المترجم،
// وإن لم تجد المفتاح تُرجع المفتاح نفسه (ليظهر النقص بوضوح أثناء التطوير).
export type TFunction = (path: string) => string

export function createT(locale: Locale): TFunction {
  const dict = getDictionary(locale)
  return (path: string): string => {
    const value = path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key]
      }
      return undefined
    }, dict)
    return typeof value === "string" ? value : path
  }
}

// تنسيق رقم حسب لغة العرض (يشمل الأرقام العربية-الهندية للعربية تلقائيًا).
export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeBcp47[locale], options).format(value)
}

// تنسيق تاريخ/وقت حسب لغة العرض.
export function formatDate(
  value: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  // منطقة زمنية ثابتة دائمًا (ما لم يُمرَّر خلاف ذلك صراحةً) كي يتطابق ناتج
  // الخادم والعميل ولا يقع خطأ عدم تطابق الترطيب.
  return new Intl.DateTimeFormat(localeBcp47[locale], { timeZone: APP_TIME_ZONE, ...options }).format(date)
}

// تنسيق تاريخ ووقت معًا.
export function formatDateTime(value: Date | string | number, locale: Locale): string {
  return formatDate(value, locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
