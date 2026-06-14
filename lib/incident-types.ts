// أنواع الحوادث وخيارات الأطراف المتضررة لنموذج الإبلاغ عن حادثة

export const INCIDENT_TYPES = [
  "اصطدام مركبين",
  "دهس",
  "اصطدام بجسم ثابت",
  "إصابة عمل",
  "سقوط بضاعة",
  "سقوط من ارتفاع",
  "حريق أو انفجار",
  "تسرب مواد خطرة",
  "صعق كهربائي",
  "إغماء أو وعكة صحية",
  "أضرار ممتلكات",
  "حادثة وشيكة (Near Miss)",
  "أخرى",
] as const

export const incidentSeverityOptions = [
  { value: "low", label: "منخفض" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "عالٍ" },
  { value: "critical", label: "بالغ" },
]

export const incidentStatusOptions = [
  { value: "open", label: "مفتوح" },
  { value: "investigating", label: "قيد التحقيق" },
  { value: "closed", label: "مغلق" },
]

export const partyAffiliationOptions = [
  { value: "employee", label: "موظف" },
  { value: "contractor", label: "مقاول" },
  { value: "visitor", label: "زائر" },
]

export const partyInjuryOptions = [
  { value: "none", label: "لا إصابة" },
  { value: "cut", label: "جرح" },
  { value: "fracture", label: "كسر" },
  { value: "burn", label: "حرق" },
  { value: "bruise", label: "كدمة" },
  { value: "death", label: "وفاة" },
]

export const partyHospitalizedOptions = [
  { value: "no", label: "لا" },
  { value: "yes", label: "نعم" },
]

const labelOf = (opts: { value: string; label: string }[], v: string) =>
  opts.find((o) => o.value === v)?.label ?? v

export type IncidentParty = {
  name: string
  nationality: string
  affiliation: string
  injuryType: string
  hospitalized: string
}

// نص مقروء لطرف واحد لعرضه في صفحة التفاصيل وملف PDF.
export function formatParty(p: IncidentParty): string {
  const parts = [
    p.name || "بدون اسم",
    p.nationality && `الجنسية: ${p.nationality}`,
    `الجهة: ${labelOf(partyAffiliationOptions, p.affiliation)}`,
    `الإصابة: ${labelOf(partyInjuryOptions, p.injuryType)}`,
    `نُقل للمستشفى: ${labelOf(partyHospitalizedOptions, p.hospitalized)}`,
  ].filter(Boolean)
  return parts.join(" — ")
}

export function formatParties(json: string | null | undefined): string {
  if (!json) return "-"
  try {
    const arr = JSON.parse(json) as IncidentParty[]
    if (!Array.isArray(arr) || arr.length === 0) return "-"
    return arr.map((p, i) => `${i + 1}. ${formatParty(p)}`).join("\n")
  } catch {
    return "-"
  }
}
