// بيانات تجريبية واقعية لسياق سوق مركزي (نقل وتفريغ خضار وفواكه)

export const palette = {
  bg: "#0B1220",
  card: "#111C33",
  accent: "#FF8A3D",
  accentSoft: "rgba(255, 138, 61, 0.14)",
  text: "#F5F5F5",
  muted: "#94A3B8",
  divider: "#1E293B",
  green: "#34D399",
  blue: "#60A5FA",
  red: "#F87171",
  yellow: "#FBBF24",
} as const

export type Kpi = {
  id: string
  label: string
  value: string
  delta: number // نسبة التغيّر٪ (سالب = انخفاض)
  goodWhenUp: boolean // هل الارتفاع إيجابي؟
  icon: "alert" | "shield" | "near" | "training"
}

export const kpis: Kpi[] = [
  { id: "violations", label: "إجمالي المخالفات هذا الشهر", value: "47", delta: 12, goodWhenUp: false, icon: "alert" },
  { id: "compliance", label: "معدل الالتزام بالسلامة", value: "88%", delta: 4, goodWhenUp: true, icon: "shield" },
  { id: "nearmiss", label: "البلاغات شبه الحادثة", value: "23", delta: -8, goodWhenUp: false, icon: "near" },
  { id: "training", label: "نسبة إكمال التدريب", value: "76%", delta: 6, goodWhenUp: true, icon: "training" },
]

// اتجاه الحوادث خلال آخر 6 أشهر
export const incidentTrend = [
  { month: "فبراير", incidents: 14 },
  { month: "مارس", incidents: 11 },
  { month: "أبريل", incidents: 16 },
  { month: "مايو", incidents: 9 },
  { month: "يونيو", incidents: 12 },
  { month: "يوليو", incidents: 7 },
]

// توزيع المخالفات حسب النوع
export const violationsByType = [
  { name: "عدم ارتداء معدات الوقاية", value: 18, fill: palette.accent },
  { name: "السرعة الزائدة (رافعات/تكاتك)", value: 12, fill: palette.blue },
  { name: "تحميل غير آمن", value: 9, fill: palette.yellow },
  { name: "التدخين في مناطق محظورة", value: 5, fill: palette.red },
  { name: "إعاقة الممرات", value: 3, fill: palette.green },
]

// أعلى مناطق الخطورة
export type RiskArea = { name: string; cases: number; trend: "up" | "down" }
export const riskAreas: RiskArea[] = [
  { name: "الرافعات الشوكية", cases: 14, trend: "up" },
  { name: "التكاتك", cases: 11, trend: "up" },
  { name: "مناطق التحميل/التفريغ", cases: 9, trend: "down" },
  { name: "ممرات المشاة", cases: 6, trend: "down" },
]

// المهام الحديثة
export type TaskStatus = "done" | "progress" | "scheduled"
export type RecentTask = { title: string; meta: string; status: TaskStatus }
export const recentTasks: RecentTask[] = [
  { title: "تفتيش ميداني - قسم التبريد", meta: "م. أحمد الغامدي", status: "done" },
  { title: "مراجعة تصاريح عمل - أعمال ساخنة", meta: "فريق السلامة", status: "progress" },
  { title: "جلسة توعية Toolbox Talk", meta: "ساحة التحميل الرئيسية", status: "scheduled" },
  { title: "تفتيش الرافعات الشوكية", meta: "ورشة الصيانة", status: "done" },
  { title: "تحقيق في بلاغ شبه حادثة", meta: "بوابة التفريغ 3", status: "progress" },
]

// المشاريع الجارية
export type Project = { name: string; progress: number }
export const projects: Project[] = [
  { name: "نظام إدارة المخالفات", progress: 85 },
  { name: "وحدة الدوريات الميدانية", progress: 60 },
  { name: "سجل تصاريح العمل", progress: 72 },
  { name: "تدريب Toolbox Talk", progress: 40 },
]

// ملخص الأداء الشهري: الحوادث مقابل الإجراءات التصحيحية
export const monthlyPerformance = [
  { month: "فبراير", incidents: 14, actions: 10 },
  { month: "مارس", incidents: 11, actions: 12 },
  { month: "أبريل", incidents: 16, actions: 13 },
  { month: "مايو", incidents: 9, actions: 11 },
  { month: "يونيو", incidents: 12, actions: 14 },
  { month: "يوليو", incidents: 7, actions: 9 },
]
