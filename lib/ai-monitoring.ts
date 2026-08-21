// خرائط وقيم المراقبة الذكية بالذكاء الاصطناعي (ساحات الرافعات الشوكية).

// الأنواع الستة للاكتشافات.
export const detectionTypeOptions = [
  { value: "no_ppe", label: "عدم ارتداء معدات الوقاية" },
  { value: "traffic_congestion", label: "ازدحام مروري" },
  { value: "unsafe_stacking", label: "تكديس غير آمن" },
  { value: "overspeed", label: "سرعة زائدة" },
  { value: "restricted_area", label: "دخول منطقة محظورة" },
  { value: "pedestrian_near_forklift", label: "اقتراب مشاة من رافعة" },
] as const

export type DetectionType = (typeof detectionTypeOptions)[number]["value"]

export const detectionTypeLabels: Record<string, string> = Object.fromEntries(
  detectionTypeOptions.map((d) => [d.value, d.label]),
)

// وصف موجز لكل نوع يُمرَّر للنموذج ليعرف ما يبحث عنه.
export const detectionTypeDescriptions: Record<DetectionType, string> = {
  no_ppe: "عامل أو أكثر لا يرتدي خوذة أو سترة عاكسة أو حذاء أمان في ساحة العمل",
  traffic_congestion: "ازدحام غير آمن للرافعات أو المركبات في ممر أو منطقة واحدة",
  unsafe_stacking: "تكديس بضائع أو منصات بشكل مائل أو مرتفع بشكل خطير أو غير مستقر",
  overspeed: "رافعة شوكية أو مركبة تتحرك بسرعة عالية داخل الساحة",
  restricted_area: "دخول شخص أو معدة إلى منطقة محظورة أو مغلقة",
  pedestrian_near_forklift: "اقتراب أحد المشاة بشكل خطير من رافعة شوكية أثناء تشغيلها",
}

// أيقونة كل نوع (أسماء lucide-react).
export const severityByType: Record<DetectionType, "low" | "medium" | "high" | "critical"> = {
  no_ppe: "medium",
  traffic_congestion: "medium",
  unsafe_stacking: "high",
  overspeed: "high",
  restricted_area: "critical",
  pedestrian_near_forklift: "critical",
}

// حالات الاكتشاف.
// converted: تم قبول الاكتشاف وتحويله إلى مخالفة رسمية (VIO-YYYY-###).
export const detectionStatusOptions = [
  { value: "new", label: "جديد" },
  { value: "acknowledged", label: "تم الاطّلاع" },
  { value: "resolved", label: "تمت المعالجة" },
  { value: "converted", label: "تم التحويل لمخالفة" },
  { value: "false_positive", label: "إنذار خاطئ" },
] as const

export type DetectionStatus = (typeof detectionStatusOptions)[number]["value"]

export const detectionStatusLabels: Record<string, string> = Object.fromEntries(
  detectionStatusOptions.map((s) => [s.value, s.label]),
)

export const detectionStatusStyles: Record<string, string> = {
  new: "bg-destructive/10 text-destructive border-destructive/20",
  acknowledged: "bg-accent/15 text-amber-700 dark:text-amber-400 border-accent/30",
  resolved: "bg-primary/10 text-primary border-primary/20",
  converted: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
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
}

// نتيجة دمج كل مخالفات الإطار الواحد في سجل واحد.
export type MergedFrameDetection = {
  primaryType: DetectionType
  primarySeverity: string
  primaryConfidence: number
  types: string[] // كل الأنواع الفريدة المرصودة في نفس اللقطة
  notes: string // ملاحظات مجمّعة «التسمية: الوصف» مفصولة بنقطة
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
    return { type, severity, confidence, description: (d.description || "").trim() }
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
  }
}
