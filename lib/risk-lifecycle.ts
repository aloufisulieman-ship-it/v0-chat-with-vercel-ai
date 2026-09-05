// دورة حياة الخطر — نموذج مشترك بين الخادم والعميل (لا يستورد قاعدة البيانات).
// open (مسجّل) → in_progress (قيد المعالجة) → verification (قيد التحقق) → closed (مغلق)

import { getRiskBand } from "@/lib/labels"

export type RiskLifecycleStatus = "open" | "in_progress" | "verification" | "closed"

export const RISK_LIFECYCLE_STATUSES: RiskLifecycleStatus[] = ["open", "in_progress", "verification", "closed"]

// عتبة الإغلاق: لا يُغلق الخطر إلا إذا هبطت الدرجة المتبقية تحتها.
export const RISK_CLOSE_THRESHOLD = 16

export function normalizeRiskStatus(v: string | null | undefined): RiskLifecycleStatus {
  return (RISK_LIFECYCLE_STATUSES as string[]).includes(v ?? "") ? (v as RiskLifecycleStatus) : "open"
}

export function riskStatusLabel(s: RiskLifecycleStatus, locale: "ar" | "en" = "ar"): string {
  const ar: Record<RiskLifecycleStatus, string> = {
    open: "مسجّل",
    in_progress: "قيد المعالجة",
    verification: "قيد التحقق",
    closed: "مغلق",
  }
  const en: Record<RiskLifecycleStatus, string> = {
    open: "Registered",
    in_progress: "In progress",
    verification: "Under verification",
    closed: "Closed",
  }
  return (locale === "en" ? en : ar)[s]
}

export function riskStatusBadgeClass(s: RiskLifecycleStatus): string {
  switch (s) {
    case "open":
      return "bg-primary/10 text-primary border-primary/20"
    case "in_progress":
      return "bg-secondary text-secondary-foreground border-border"
    case "verification":
      return "bg-risk-medium/20 text-risk-medium-foreground border-risk-medium/30"
    case "closed":
      return "bg-muted text-muted-foreground border-border"
  }
}

export function riskScore(likelihood: number | null | undefined, consequence: number | null | undefined): number {
  return (likelihood ?? 1) * (consequence ?? 1)
}

// الدرجة المتبقية بعد إعادة التقييم إن وُجدت، وإلا الدرجة الأصلية.
export function residualScore(r: {
  likelihood?: number | null
  consequence?: number | null
  residualLikelihood?: number | null
  residualConsequence?: number | null
}): number {
  if (r.residualLikelihood != null && r.residualConsequence != null) {
    return r.residualLikelihood * r.residualConsequence
  }
  return riskScore(r.likelihood, r.consequence)
}

export function hasReassessment(r: { residualLikelihood?: number | null; residualConsequence?: number | null }): boolean {
  return r.residualLikelihood != null && r.residualConsequence != null
}

// نسبة انخفاض الدرجة بعد التنفيذ (0–100).
export function reductionPct(before: number, after: number): number {
  if (before <= 0) return 0
  return Math.max(0, Math.round(((before - after) / before) * 100))
}

export function canCloseRisk(before: number, after: number): boolean {
  return hasReassessmentScore(after) && after < RISK_CLOSE_THRESHOLD && after <= before
}

function hasReassessmentScore(after: number): boolean {
  return Number.isFinite(after) && after > 0
}

// يعيد معرّف النطاق (low/medium/high/critical) لأي درجة — لإعادة استخدام ألوان المصفوفة.
export function bandOf(score: number) {
  return getRiskBand(score)
}
