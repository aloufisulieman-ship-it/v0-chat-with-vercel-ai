export type SignatureRole = { key: string; label: string }

// Official, role-named signature slots per module.
// The attachment `kind` is stored as `signature:<key>` so each role is distinct.
export const signatureRoles: Record<string, SignatureRole[]> = {
  violations: [
    { key: "violator", label: "توقيع المخالف" },
    { key: "reporter", label: "توقيع المُبلِّغ / المشرف" },
    { key: "safety_manager", label: "توقيع مدير السلامة" },
  ],
  incidents: [
    { key: "reporter", label: "توقيع المُبلِّغ" },
    { key: "supervisor", label: "توقيع المشرف المباشر" },
    { key: "safety_manager", label: "توقيع مدير السلامة" },
  ],
  training: [{ key: "trainer", label: "توقيع المدرب" }],
}

// أدوار توقيع خاصة بمسار المعالجة (تُحقن شرطياً في نافذة التفاصيل):
// - توقيع موظف الموارد البشرية يظهر فقط لمخالفات قسم HR (الفئة الداخلية).
// - توقيع موظف المالية يظهر فقط لمخالفات قسم المالية (الفئة الخارجية).
// كل منهما شرط مستقل لإغلاق مخالفة قسمه.
export const HR_OFFICER_SIGNATURE_ROLE: SignatureRole = {
  key: "hr_officer",
  label: "توقيع موظف الموارد البشرية",
}
export const FINANCE_OFFICER_SIGNATURE_ROLE: SignatureRole = {
  key: "finance_officer",
  label: "توقيع موظف المالية",
}
// توقيع المدقق الذي حوّل الرصد الآلي (المراقبة الذكية) إلى مخالفة ووجّهها.
// يظهر للقراءة فقط في تفاصيل المخالفات الآلية إلى جانب توقيع موظف الموارد البشرية.
export const AUDITOR_SIGNATURE_ROLE: SignatureRole = {
  key: "auditor",
  label: "توقيع المدقق",
}

export const SIGNATURE_KIND_PREFIX = "signature:"

export function roleKindFor(roleKey: string) {
  return `${SIGNATURE_KIND_PREFIX}${roleKey}`
}

export function roleKeyFromKind(kind: string) {
  return kind.startsWith(SIGNATURE_KIND_PREFIX) ? kind.slice(SIGNATURE_KIND_PREFIX.length) : null
}

// Look up the human label for any signature kind, falling back gracefully.
export function labelForSignatureKind(module: string, kind: string): string {
  const key = roleKeyFromKind(kind)
  if (!key) return "توقيع"
  const found =
    signatureRoles[module]?.find((r) => r.key === key) ??
    [HR_OFFICER_SIGNATURE_ROLE, FINANCE_OFFICER_SIGNATURE_ROLE, AUDITOR_SIGNATURE_ROLE].find((r) => r.key === key)
  return found?.label ?? "توقيع"
}
