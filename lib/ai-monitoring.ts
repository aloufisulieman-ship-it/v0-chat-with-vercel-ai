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
export const detectionStatusOptions = [
  { value: "new", label: "جديد" },
  { value: "acknowledged", label: "تم الاطّلاع" },
  { value: "resolved", label: "تمت المعالجة" },
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
