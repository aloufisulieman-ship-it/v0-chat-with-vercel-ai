"use server"

// server action لتبديل لغة الواجهة: يكتب الكوكي (تطبيق فوري) ويحفظ التفضيل في
// عمود user.locale (بقاء دائم عبر كل الجلسات والأجهزة).

import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { auth } from "@/lib/auth"
import { LOCALE_COOKIE, normalizeLocale, type Locale } from "@/lib/i18n/config"

export async function setLocale(next: string): Promise<{ locale: Locale }> {
  const locale = normalizeLocale(next)

  // 1) الكوكي: يُقرأ فورًا في الخادم والعميل (سنة كاملة).
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })

  // 2) الحفظ الدائم في قاعدة البيانات لكل مستخدم مسجّل دخول (إن وُجد).
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (session?.user) {
      await db.update(userTable).set({ locale }).where(eq(userTable.id, session.user.id))
    }
  } catch {
    /* حتى لو تعذّر الحفظ في قاعدة البيانات يبقى الكوكي فعّالاً */
  }

  // إعادة تصيير كل الصفحات باللغة الجديدة.
  revalidatePath("/", "layout")
  return { locale }
}
