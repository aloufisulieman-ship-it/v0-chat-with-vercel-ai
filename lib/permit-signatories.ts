// ============ المُوقّعون المعتمدون لتصاريح العمل ============
// أسماء ثابتة تُملأ تلقائياً حسب الدور (لا تُكتب يدوياً). وحدة آمنة للعميل والخادم.
// المصدر الوحيد لأسماء ومسميات المُوقّعين في الواجهة والطباعة والـ seed.
import type { SignRole } from "@/lib/permit-workflow"

export interface Signatory {
  ar: string
  en: string
  // الاسم الثابت للموقّع، أو "" إذا كان يُدخل يدوياً (منفذ العمل يتغيّر حسب المهمة).
  name: string
  fixed: boolean
}

export const PERMIT_SIGNATORIES: Record<SignRole, Signatory> = {
  requester: { ar: "مسؤول الورشة", en: "Workshop manager", name: "حسين العوفي", fixed: true },
  issuer: { ar: "مشرف الورشة", en: "Workshop supervisor", name: "محمد الصبحي", fixed: true },
  safety: { ar: "مشرف السلامة", en: "Safety supervisor", name: "نصر السعدي", fixed: true },
  // الاعتماد النهائي الذي يحوّل الحالة إلى "ساري".
  approver: { ar: "مسؤول السلامة", en: "Safety officer", name: "سليمان العوفي", fixed: true },
  // توقيعات الإغلاق.
  closeIssuer: { ar: "منفذ العمل", en: "Work executor", name: "", fixed: false },
  closeReceiver: { ar: "مسؤول السلامة", en: "Safety officer", name: "سليمان العوفي", fixed: true },
}

// ترتيب عرض شبكة التواقيع (RTL): الصف الأول للإصدار والاعتماد، الثاني للإغلاق.
export const SIGN_ROW_ISSUANCE: SignRole[] = ["requester", "issuer", "safety", "approver"]
export const SIGN_ROW_CLOSURE: SignRole[] = ["closeIssuer", "closeReceiver"]

export function signatoryName(role: SignRole): string {
  return PERMIT_SIGNATORIES[role].name
}

export function signatoryLabel(role: SignRole, loc: "ar" | "en" = "ar"): string {
  const s = PERMIT_SIGNATORIES[role]
  return loc === "ar" ? s.ar : s.en
}
