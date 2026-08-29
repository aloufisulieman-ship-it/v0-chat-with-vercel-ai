// أداة الخادم: تحسم اللغة الحالية بمصدر واحد موحّد لكل الطلب، وتوفّر t() للـ
// Server Components. مصدر اللغة الموحّد: تفضيل المستخدم المحفوظ في قاعدة البيانات
// له الأولوية (ثبات عبر كل الأجهزة والجلسات)، وإلا الكوكي، وإلا الافتراضية.
// هذا يطابق تمامًا ما يفعله التخطيط الجذري وموفّر الترجمة للعميل، فلا يحدث تناقض
// بين الأجزاء المُصيَّرة من الخادم (العناوين، رؤوس الجداول، مؤشرات الأداء) والأجزاء
// من العميل (القائمة الجانبية، الحوارات) على الصفحة نفسها.

import "server-only"
import { cookies } from "next/headers"
import { LOCALE_COOKIE, normalizeLocale, localeDirection, type Locale } from "./config"
import { createT, type TFunction } from "./translate"
import { getCurrentUser } from "@/lib/session"

// اللغة من الكوكي فقط (المصدر الاحتياطي للزائر غير المسجّل). Next.js 16: cookies() غير متزامنة.
async function getCookieLocale(): Promise<Locale> {
  const store = await cookies()
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value)
}

// تفضيل اللغة المحفوظ في قاعدة البيانات للمستخدم المسجّل (إن وُجد). getCurrentUser
// مُخزَّن عبر React cache() فلا يضيف أي استعلام إضافي عندما تكون الصفحة قد جلبت المستخدم.
async function getUserLocale(): Promise<Locale | null> {
  const currentUser = await getCurrentUser().catch(() => null)
  return currentUser?.locale ? normalizeLocale(currentUser.locale) : null
}

// اللغة الفعّالة للطلب: قاعدة البيانات أولاً (ثبات عبر الأجهزة) ثم الكوكي.
// هذا هو المصدر الوحيد الذي تعتمده كل صفحات الخادم عبر getServerT.
export async function getServerLocale(): Promise<Locale> {
  const userLocale = await getUserLocale()
  if (userLocale) return userLocale
  return getCookieLocale()
}

// اللغة الفعّالة للعرض مع تمرير تفضيل قاعدة البيانات صراحةً (يستخدمها التخطيط الجذري،
// حيث يملك صفّ المستخدم مسبقاً فيتجنّب جلبه مرتين).
export async function resolveLocale(dbLocale?: string | null): Promise<Locale> {
  if (dbLocale) return normalizeLocale(dbLocale)
  return getCookieLocale()
}

// كائن الترجمة الجاهز للخادم: { locale, t, dir }.
export async function getServerT(): Promise<{ locale: Locale; t: TFunction; dir: "rtl" | "ltr" }> {
  const locale = await getServerLocale()
  return { locale, t: createT(locale), dir: localeDirection[locale] }
}
