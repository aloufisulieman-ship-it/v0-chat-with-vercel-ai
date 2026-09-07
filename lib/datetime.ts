// ================= أدوات التاريخ والوقت — توقيت مسقط (Asia/Muscat, UTC+4 بلا توقيت صيفي) =================
// السياسة: تُخزَّن كل الأوقات كلحظات UTC، وتُعرض دائماً بتوقيت مسقط.
// وحدة آمنة للعميل والخادم (لا تستورد شيئاً من الخادم).

export const MUSCAT_TZ = "Asia/Muscat"
const MUSCAT_OFFSET_MS = 4 * 60 * 60 * 1000

// تنسيق لحظة (ISO/Date) بتوقيت مسقط بنظام 12 ساعة (ص/م).
export function formatMuscatDateTime(value: string | Date | null | undefined, locale: "ar" | "en" = "ar"): string {
  if (!value) return "—"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-OM", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    timeZone: MUSCAT_TZ,
  }).format(d)
}

// تنسيق التاريخ فقط بتوقيت مسقط.
export function formatMuscatDate(value: string | Date | null | undefined, locale: "ar" | "en" = "ar"): string {
  if (!value) return "—"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-OM", {
    dateStyle: "medium",
    timeZone: MUSCAT_TZ,
  }).format(d)
}

// يحوّل نص ساعة الحائط القادم من <input type="datetime-local"> (يُفترض أنه بتوقيت مسقط،
// بلا معلومة منطقة زمنية) إلى لحظة UTC صحيحة للتخزين. يقبل "YYYY-MM-DDTHH:MM[:SS]".
export function muscatLocalToUtc(local: string | null | undefined): Date | null {
  if (!local) return null
  const m = String(local).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) {
    const d = new Date(local)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const [, y, mo, d, h, mi, sRaw] = m
  const utcAsIfLocal = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sRaw ?? "0"))
  return new Date(utcAsIfLocal - MUSCAT_OFFSET_MS)
}

// يتحقق أن وقت الانتهاء بعد وقت البدء (يقبل Date أو نص).
export function isEndAfterStart(start: string | Date | null | undefined, end: string | Date | null | undefined): boolean {
  if (!start || !end) return true
  const s = start instanceof Date ? start.getTime() : new Date(start).getTime()
  const e = end instanceof Date ? end.getTime() : new Date(end).getTime()
  if (Number.isNaN(s) || Number.isNaN(e)) return true
  return e > s
}
