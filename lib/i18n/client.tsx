"use client"

// موفّر الترجمة للعميل: يحمل اللغة الحالية (قادمة من الخادم) ويوفّر hook
// useI18n() لكل المكوّنات — بلا تكرار منطق الترجمة في أي مكوّن.

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { type Locale, localeDirection } from "./config"
import { createT, formatNumber, formatDate, formatDateTime, type TFunction } from "./translate"

type I18nContextValue = {
  locale: Locale
  dir: "rtl" | "ltr"
  t: TFunction
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
  formatDateTime: (value: Date | string | number) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(() => {
    const t = createT(locale)
    return {
      locale,
      dir: localeDirection[locale],
      t,
      formatNumber: (v, options) => formatNumber(v, locale, options),
      formatDate: (v, options) => formatDate(v, locale, options),
      formatDateTime: (v) => formatDateTime(v, locale),
    }
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// hook الترجمة للعميل. يجب استخدامه داخل I18nProvider.
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error("useI18n must be used within <I18nProvider>")
  }
  return ctx
}
