// أداة الخادم: تقرأ اللغة الحالية من الكوكي (المصدر السريع) وتوفّر t() للـ
// Server Components. الكوكي يُكتب من server action ويُزامَن مع عمود المستخدم.

import "server-only"
import { cookies } from "next/headers"
import { LOCALE_COOKIE, normalizeLocale, type Locale } from "./config"
import { createT, type TFunction } from "./translate"

// اللغة الحالية من الكوكي (Next.js 16: cookies() غير متزامنة).
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies()
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value)
}

// اللغة الفعّالة للعرض: تفضيل المستخدم المحفوظ في قاعدة البيانات (إن وُجد) له
// الأولوية ليبقى ثابتًا عبر كل الأجهزة والجلسات، وإلا نعتمد الكوكي. تُستخدم في
// التخطيط الجذري. dbLocale يأتي من جلسة المستخدم (قد يكون null لزائر غير مسجّل).
export async function resolveLocale(dbLocale?: string | null): Promise<Locale> {
  if (dbLocale) return normalizeLocale(dbLocale)
  return getServerLocale()
}

// كائن الترجمة الجاهز للخادم: { locale, t, dir }.
export async function getServerT(): Promise<{ locale: Locale; t: TFunction }> {
  const locale = await getServerLocale()
  return { locale, t: createT(locale) }
}
