import type React from "react"
import type { Metadata } from "next"
import { Cairo } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import { getCurrentUser } from "@/lib/session"
import { resolveLocale } from "@/lib/i18n/server"
import { localeDirection } from "@/lib/i18n/config"
import { I18nProvider } from "@/lib/i18n/client"
import "./globals.css"

// خط Cairo يدعم العربية واللاتينية معًا، فيناسب كلتا اللغتين بلا خط إضافي.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
})

export const metadata: Metadata = {
  title: "نظام إدارة الصحة والسلامة والبيئة | HSE",
  description: "منصة متكاملة لإدارة الصحة والسلامة المهنية والبيئة - الحوادث، التفتيش، تقييم المخاطر، التدريب والتقارير",
  generator: "v0.app",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // اللغة الفعّالة: تفضيل المستخدم المحفوظ في قاعدة البيانات له الأولوية (ثبات عبر
  // كل الأجهزة)، وإلا الكوكي. تُطبّق على dir/lang وتُمرَّر لموفّر الترجمة للعميل.
  const currentUser = await getCurrentUser().catch(() => null)
  const locale = await resolveLocale(currentUser?.locale)
  const dir = localeDirection[locale]

  return (
    <html lang={locale} dir={dir} className="bg-background">
      <body className={`${cairo.variable} font-sans antialiased`}>
        <I18nProvider locale={locale}>
          {children}
          <Toaster />
        </I18nProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
