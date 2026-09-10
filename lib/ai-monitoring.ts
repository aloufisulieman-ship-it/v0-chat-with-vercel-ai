// خرائط وقيم المراقبة الذكية بالذكاء الاصطناعي (ساحات الرافعات الشوكية).

// أنواع الاكتشافات: 6 سلوكية (تُحال إلى مسار المخالفات) + 8 حوادث/بيئية
// (تُصعَّد آلياً إلى حوادث/حوادث وشيكة/إجراءات تصحيحية).
export const detectionTypeOptions = [
  // --- التزام / سلوكية (compliance) ---
  { value: "no_ppe", label: "عدم ارتداء معدات الوقاية" },
  { value: "no_safety_shoes", label: "عدم ارتداء حذاء السلامة" },
  { value: "no_reflective_vest", label: "عدم ارتداء السترة العاكسة" },
  // --- مخاطر (hazard) ---
  { value: "traffic_congestion", label: "ازدحام مروري" },
  { value: "unsafe_stacking", label: "تكديس غير آمن" },
  { value: "overspeed", label: "سرعة زائدة" },
  { value: "restricted_area", label: "دخول منطقة محظورة" },
  { value: "pedestrian_near_forklift", label: "اقتراب مشاة من رافعة" },
  { value: "fall_risk_height", label: "خطر سقوط من ارتفاع" },
  // --- أحداث (event) ---
  { value: "collision", label: "اصطدام" },
  { value: "pedestrian_struck", label: "اصطدام رافعة بشخص" },
  { value: "load_drop", label: "سقوط حمولة" },
  { value: "person_fall", label: "سقوط شخص" },
  { value: "fire_smoke", label: "دخان أو حريق" },
  { value: "near_miss", label: "حادث وشيك" },
  // --- بيئية (environmental hazards) ---
  { value: "spill_leak", label: "انسكاب أو تسرب" },
  { value: "blocked_exit", label: "مخرج طوارئ مسدود" },
] as const

export type DetectionType = (typeof detectionTypeOptions)[number]["value"]

// فئة كل نوع — تحدّد مسار التصعيد والتجميع في اللوحة.
export type DetectionCategory = "behavioral" | "incident" | "environmental"

export const detectionCategoryByType: Record<DetectionType, DetectionCategory> = {
  no_ppe: "behavioral",
  no_safety_shoes: "behavioral",
  no_reflective_vest: "behavioral",
  traffic_congestion: "behavioral",
  unsafe_stacking: "behavioral",
  overspeed: "behavioral",
  restricted_area: "behavioral",
  pedestrian_near_forklift: "behavioral",
  fall_risk_height: "behavioral",
  collision: "incident",
  pedestrian_struck: "incident",
  load_drop: "incident",
  person_fall: "incident",
  fire_smoke: "incident",
  near_miss: "incident",
  spill_leak: "environmental",
  blocked_exit: "environmental",
}

// ===== محور «تصنيف الكشف» (detection_class) — المصدر الرسمي للخطورة والتصعيد =====
// event (حدث): وقوع فعلي (سقوط شخص/اصطدام/دخان...) — حرج، يُصعَّد إلى حادث عند ثقة عالية.
// hazard (خطر): ظرف خطر محتمل دون وقوع حدث (وقوف على ارتفاع، تكديس مائل، سرعة...) —
//   متوسط، مساره مخالفة/حادث وشيك أو إجراء تصحيحي — لا يُنشئ حادثاً أبداً.
// compliance (التزام): مخالفة اشتراطات وقاية شخصية (PPE) — منخفض.
export type DetectionClass = "event" | "hazard" | "compliance"

export const detectionClassByType: Record<DetectionType, DetectionClass> = {
  no_ppe: "compliance",
  no_safety_shoes: "compliance",
  no_reflective_vest: "compliance",
  traffic_congestion: "hazard",
  unsafe_stacking: "hazard",
  overspeed: "hazard",
  restricted_area: "hazard",
  pedestrian_near_forklift: "hazard",
  fall_risk_height: "hazard",
  spill_leak: "hazard",
  blocked_exit: "hazard",
  near_miss: "hazard",
  collision: "event",
  pedestrian_struck: "event",
  load_drop: "event",
  person_fall: "event",
  fire_smoke: "event",
}

// عتبات الثقة حسب التصنيف (نسبة مئوية 0-100).
export const EVENT_AUTO_ESCALATE_THRESHOLD = 85 // حدث ≥ 85% → تصعيد تلقائي إلى حادث
export const EVENT_REVIEW_MIN = 60 // حدث 60-84% → «يحتاج مراجعة» بلا تصعيد
export const HAZARD_MIN_CONFIDENCE = 70 // خطر ≥ 70% → قابل للإجراء (مخالفة/وشيك)
export const DISPLAY_MIN_CONFIDENCE = 60 // أي كشف < 60% → سجل خام فقط، لا يظهر في المؤشرات

// الخطورة الأساسية حسب التصنيف: event=حرجة، hazard=متوسطة، compliance=منخفضة.
export const severityByClass: Record<DetectionClass, "low" | "medium" | "high" | "critical"> = {
  event: "critical",
  hazard: "medium",
  compliance: "low",
}

// عدد تكرارات نفس نوع الخطر في نفس الموقع خلال 24 ساعة الذي يرفع خطورته من متوسطة إلى عالية.
export const HAZARD_ESCALATE_REPEAT = 3

// خيارات فلتر «التصنيف» في اللوحة.
export const detectionClassOptions = [
  { value: "event", label: "حدث" },
  { value: "hazard", label: "خطر" },
  { value: "compliance", label: "التزام" },
] as const

export const detectionClassLabels: Record<string, string> = {
  event: "حدث",
  hazard: "خطر",
  compliance: "التزام",
}

export const detectionClassStyles: Record<string, string> = {
  event: "bg-destructive/10 text-destructive border-destructive/20",
  hazard: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  compliance: "bg-primary/10 text-primary border-primary/20",
}

// هدف التصعيد التلقائي لكل نوع (ISO 45001):
//   violation = مسار المخالفات السلوكية (كما هو) | incident = سجل حادث آلي |
//   near_miss = سجل الحوادث الوشيكة | corrective_action = إجراء تصحيحي بيئي.
export type EscalationTarget = "none" | "violation" | "incident" | "near_miss" | "corrective_action"

export const escalationTargetByType: Record<DetectionType, EscalationTarget> = {
  no_ppe: "violation",
  no_safety_shoes: "violation",
  no_reflective_vest: "violation",
  traffic_congestion: "violation",
  unsafe_stacking: "violation",
  overspeed: "violation",
  restricted_area: "violation",
  pedestrian_near_forklift: "violation",
  fall_risk_height: "near_miss",
  collision: "incident",
  pedestrian_struck: "incident",
  load_drop: "incident",
  person_fall: "incident",
  fire_smoke: "incident",
  near_miss: "near_miss",
  spill_leak: "corrective_action",
  blocked_exit: "corrective_action",
}

// عتبة الثقة لاعتماد الكشف تلقائياً (نسبة مئوية 0-100). أقل من ذلك يُحفظ الكشف
// بحالة «يحتاج مراجعة» ولا يُصعَّد آلياً حتى يعتمده المدقق.
export const CONFIDENCE_THRESHOLD = 70

// الفئات الثلاث لفلتر «فئة الكشف» في اللوحة.
export const detectionCategoryOptions = [
  { value: "behavioral", label: "سلوكية" },
  { value: "incident", label: "حوادث" },
  { value: "environmental", label: "بيئية" },
] as const

// مجموعات بطاقات KPI: الصف الأول (سلوكية) والصف الثاني (كشف الحوادث/البيئية).
export const behavioralTypeOptions = detectionTypeOptions.filter(
  (o) => detectionCategoryByType[o.value] === "behavioral",
)
// بطاقات صف «كشف الحوادث» الستة كما في المواصفة.
export const incidentKpiTypes: DetectionType[] = [
  "collision",
  "spill_leak",
  "load_drop",
  "near_miss",
  "fire_smoke",
  "blocked_exit",
]

export const detectionTypeLabels: Record<string, string> = Object.fromEntries(
  detectionTypeOptions.map((d) => [d.value, d.label]),
)

// وصف موجز لكل نوع يُمرَّر للنموذج ليعرف ما يبحث عنه.
export const detectionTypeDescriptions: Record<DetectionType, string> = {
  no_ppe: "عامل أو أكثر لا يرتدي معدات الوقاية الأساسية (خوذة على الأقل) في ساحة العمل",
  no_safety_shoes: "عامل لا يرتدي حذاء السلامة في منطقة تشغيل الرافعات",
  no_reflective_vest: "عامل لا يرتدي السترة العاكسة في ساحة حركة المعدات",
  fall_risk_height:
    "شخص متزن يقف على سطح مرتفع أو حافة مركبة/شاحنة أو سلّم دون حماية سقوط — خطر وليس حادثاً",
  traffic_congestion: "ازدحام غير آمن للرافعات أو المركبات في ممر أو منطقة واحدة",
  unsafe_stacking: "تكديس بضائع أو منصات بشكل مائل أو مرتفع بشكل خطير أو غير مستقر",
  overspeed: "رافعة شوكية أو مركبة تتحرك بسرعة عالية داخل الساحة",
  restricted_area: "دخول شخص أو معدة إلى منطقة محظورة أو مغلقة",
  pedestrian_near_forklift: "اقتراب أحد المشاة بشكل خطير من رافعة شوكية أثناء تشغيلها",
  collision: "اصطدام رافعة برافعة أخرى أو بمركبة أو بهيكل/رفّ داخل الساحة",
  pedestrian_struck: "اصطدام رافعة أو مركبة بشخص (حادث إصابة محتمل)",
  load_drop: "سقوط حمولة أو طبلية من الرافعة أو من ارتفاع",
  person_fall: "سقوط شخص على الأرض أو من ارتفاع",
  fire_smoke: "ظهور دخان أو ألسنة لهب أو حريق في الساحة",
  near_miss: "اقتراب خطر شديد بين رافعة وشخص/معدة دون حدوث تماس (حادث وشيك)",
  spill_leak: "انسكاب سائل أو تسرب زيت أو وقود على أرضية الساحة",
  blocked_exit: "مخرج طوارئ أو طفاية حريق أو لوحة كهرباء مسدودة أو محجوبة",
}

// أيقونة كل نوع (أسماء lucide-react).
// خطورة احتياطية لكل نوع (تُستخدم فقط كبديل داخل mergeFrameViolations؛ الخطورة
// الرسمية للسجل تُشتق من التصنيف عبر severityByClass عند الحفظ).
export const severityByType: Record<DetectionType, "low" | "medium" | "high" | "critical"> = {
  no_ppe: "low",
  no_safety_shoes: "low",
  no_reflective_vest: "low",
  traffic_congestion: "medium",
  unsafe_stacking: "medium",
  overspeed: "medium",
  restricted_area: "medium",
  pedestrian_near_forklift: "medium",
  fall_risk_height: "medium",
  // حوادث/بيئية — الخطورة التلقائية حسب المواصفة.
  pedestrian_struck: "critical",
  person_fall: "critical",
  fire_smoke: "critical",
  collision: "high",
  load_drop: "high",
  spill_leak: "medium",
  blocked_exit: "medium",
  near_miss: "medium",
}

// حالات الاكتشاف.
// converted: تم قبول الاكتشاف وتحويله إلى مخالفة رسمية (VIO-YYYY-###).
export const detectionStatusOptions = [
  { value: "new", label: "جديد" },
  { value: "needs_review", label: "يحتاج مراجعة" },
  { value: "acknowledged", label: "تم الاطّلاع" },
  { value: "resolved", label: "تمت المعالجة" },
  { value: "converted", label: "تم التحويل لمخالفة" },
  { value: "escalated", label: "مُصعّد آلياً" },
  { value: "false_positive", label: "إنذار خاطئ" },
] as const

export type DetectionStatus = (typeof detectionStatusOptions)[number]["value"]

export const detectionStatusLabels: Record<string, string> = Object.fromEntries(
  detectionStatusOptions.map((s) => [s.value, s.label]),
)

export const detectionStatusStyles: Record<string, string> = {
  new: "bg-destructive/10 text-destructive border-destructive/20",
  needs_review: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
  acknowledged: "bg-accent/15 text-amber-700 dark:text-amber-400 border-accent/30",
  resolved: "bg-primary/10 text-primary border-primary/20",
  converted: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  escalated: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  false_positive: "bg-muted text-muted-foreground border-border",
}

export const severityLabels: Record<string, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "عالٍ",
  critical: "حرج",
}

export const severityStyles: Record<string, string> = {
  low: "bg-primary/10 text-primary border-primary/20",
  medium: "bg-accent/15 text-amber-700 dark:text-amber-400 border-accent/30",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
}

// أنواع/خطورة صالحة، وترتيب الخطورة — تُستخدم في دمج مخالفات الإطار الواحد.
export const VALID_DETECTION_TYPES = detectionTypeOptions.map((d) => d.value) as string[]
export const VALID_SEVERITIES = ["low", "medium", "high", "critical"] as const
const SEVERITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }

// مخالفة واحدة مرصودة داخل إطار (قبل التطبيع).
export type FrameViolation = {
  type: string
  severity?: string
  confidence: number
  description?: string
  // الدلائل المرئية المحددة التي اعتمد عليها النموذج (تُخزَّن في evidence_criteria).
  evidence?: string[]
  reasoning?: string
}

// نتيجة دمج كل مخالفات الإطار الواحد في سجل واحد.
export type MergedFrameDetection = {
  primaryType: DetectionType
  primarySeverity: string
  primaryConfidence: number
  types: string[] // كل الأنواع الفريدة المرصودة في نفس اللقطة
  notes: string // ملاحظات مجمّعة «التسمية: الوصف» مفصولة بنقطة
  // دلائل وتعليل النوع الأساسي (لتغذية evidence_criteria والتحقق البشري).
  evidence: string[]
  reasoning: string
}

// دالة نقية (قابلة للاختبار) تدمج كل المخالفات المرصودة في إطار/لقطة واحدة إلى
// سجل واحد: تُطبّع الأنواع والخطورة والثقة، تُزيل التكرار حسب النوع (نُبقي الأعلى
// ثقة)، تختار المخالفة الأساسية (الأشد خطورة ثم الأعلى ثقة)، وتُجمّع الأنواع
// والملاحظات. تُرجع null إذا لم تُرصد أي مخالفة.
export function mergeFrameViolations(violations: FrameViolation[]): MergedFrameDetection | null {
  if (!violations || violations.length === 0) return null

  const normalized = violations.map((d) => {
    const type = (VALID_DETECTION_TYPES.includes(d.type) ? d.type : "no_ppe") as DetectionType
    const severity =
      d.severity && (VALID_SEVERITIES as readonly string[]).includes(d.severity)
        ? d.severity
        : severityByType[type]
    const confidence = Math.max(0, Math.min(100, Math.round(d.confidence || 0)))
    const evidence = Array.isArray(d.evidence) ? d.evidence.map((e) => String(e).trim()).filter(Boolean) : []
    const reasoning = (d.reasoning || "").trim()
    return { type, severity, confidence, description: (d.description || "").trim(), evidence, reasoning }
  })

  // إزالة التكرار حسب النوع داخل نفس الإطار (نُبقي الأعلى ثقة لكل نوع).
  const byType = new Map<string, (typeof normalized)[number]>()
  for (const d of normalized) {
    const existing = byType.get(d.type)
    if (!existing || d.confidence > existing.confidence) byType.set(d.type, d)
  }
  const unique = [...byType.values()]

  // المخالفة الأساسية = الأشد خطورة، ثم الأعلى ثقة.
  const primary = unique.reduce((best, d) => {
    const dr = SEVERITY_RANK[d.severity] ?? 0
    const br = SEVERITY_RANK[best.severity] ?? 0
    if (dr > br || (dr === br && d.confidence > best.confidence)) return d
    return best
  })

  const notes = unique
    .map((d) => {
      const label = detectionTypeLabels[d.type] ?? d.type
      return d.description ? `${label}: ${d.description}` : label
    })
    .join(" • ")
    .slice(0, 1000)

  return {
    primaryType: primary.type,
    primarySeverity: primary.severity,
    primaryConfidence: primary.confidence,
    types: unique.map((d) => d.type),
    notes,
    evidence: primary.evidence,
    reasoning: primary.reasoning,
  }
}
