// محرّك حساب حالة المطابقة لكل بند من بنود ISO 45001 تلقائياً من بيانات النظام.
// دالة نقية (بلا وصول لقاعدة البيانات) تستقبل السجلات المجلوبة مسبقاً، ليسهُل
// إعادة استخدامها في صفحة /compliance وفي تقرير جاهزية التدقيق لاحقاً.

import { iso45001Clauses, type ClauseStatus } from "./iso45001-clauses"

type Row = Record<string, unknown>

export type ComplianceInput = {
  incidents: Row[]
  inspections: Row[]
  permits: Row[]
  risks: Row[]
  actions: Row[]
  violations: Row[]
  documents: Row[]
  trainings: Row[]
  employeeCount: number
  // وحدات المرحلة الثانية (ISO 45001).
  contextIssues: Row[]
  policies: Row[]
  objectives: Row[]
  legalRequirements: Row[]
}

export type ClauseAssessment = {
  status: ClauseStatus
  auto: boolean // هل حُسبت الحالة آلياً من البيانات
  metricAr?: string // سطر مختصر بالدليل الكمّي (عربي)
  metricEn?: string
  updatedAt?: string | null // أحدث نشاط في الوحدة المرتبطة (ISO)
}

export type ComplianceResult = {
  byClause: Record<string, ClauseAssessment>
  overall: number // نسبة المطابقة الإجمالية % (على البنود المُقيَّمة فقط)
  counts: Record<ClauseStatus, number> // توزيع كل البنود على الحالات
  assessedCount: number
  totalCount: number
}

// أحدث تاريخ إنشاء ضمن مجموعة سجلات (لعمود «آخر تحديث»).
function latest(rows: Row[]): string | null {
  let max = 0
  for (const r of rows) {
    const v = r.createdAt
    const t = v instanceof Date ? v.getTime() : v ? new Date(String(v)).getTime() : 0
    if (Number.isFinite(t) && t > max) max = t
  }
  return max > 0 ? new Date(max).toISOString() : null
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

// يحسب حالة كل بند قابل للتقييم الآلي في هذه المرحلة. البنود غير المربوطة تبقى
// "لم يُقيَّم بعد" (بانتظار وحدات المرحلة الثانية أو تقييم يدوي).
export function computeCompliance(input: ComplianceInput): ComplianceResult {
  const byClause: Record<string, ClauseAssessment> = {}

  // 6.1.2 — تحديد وتقييم المخاطر ← وحدة تقييم المخاطر
  {
    const total = input.risks.length
    const score = (r: Row) => (Number(r.likelihood) || 0) * (Number(r.consequence) || 0)
    const openHigh = input.risks.filter((r) => score(r) >= 9 && String(r.status) !== "closed").length
    const withControls = input.risks.filter((r) => String(r.controls ?? "").trim().length > 0).length
    let status: ClauseStatus = "non_compliant"
    if (total > 0) status = openHigh > 0 || withControls < total ? "partial" : "compliant"
    byClause["6.1.2"] = {
      status,
      auto: true,
      metricAr: `${total} تقييم مخاطر، ${withControls} بضوابط، ${openHigh} مرتفع مفتوح`,
      metricEn: `${total} risk assessments, ${withControls} with controls, ${openHigh} high open`,
      updatedAt: latest(input.risks),
    }
  }

  // 8.1.2 — إزالة/تقليل المخاطر ← تصاريح العمل
  {
    const total = input.permits.length
    const expired = input.permits.filter((p) => String(p.status) === "expired").length
    let status: ClauseStatus = "non_compliant"
    if (total > 0) status = expired > 0 ? "partial" : "compliant"
    byClause["8.1.2"] = {
      status,
      auto: true,
      metricAr: `${total} تصريح عمل، ${expired} منتهٍ`,
      metricEn: `${total} work permits, ${expired} expired`,
      updatedAt: latest(input.permits),
    }
  }

  // 7.2 و7.3 — الكفاءة والوعي ← التدريب (تغطية الموظفين المدرَّبين)
  {
    const totalTrainings = input.trainings.length
    const completed = input.trainings.filter((t) => String(t.status) === "closed").length
    const attendeesSum = input.trainings.reduce((a, t) => a + (Number(t.attendees) || 0), 0)
    const coverage = input.employeeCount > 0 ? Math.min(100, pct(attendeesSum, input.employeeCount)) : totalTrainings > 0 ? 100 : 0
    let status: ClauseStatus = "non_compliant"
    if (totalTrainings > 0 && attendeesSum > 0) status = coverage >= 80 ? "compliant" : coverage >= 40 ? "partial" : "non_compliant"
    const assessment: ClauseAssessment = {
      status,
      auto: true,
      metricAr: `${completed}/${totalTrainings} دورة مكتملة، تغطية ${coverage}%`,
      metricEn: `${completed}/${totalTrainings} completed, ${coverage}% coverage`,
      updatedAt: latest(input.trainings),
    }
    byClause["7.2"] = assessment
    byClause["7.3"] = assessment
  }

  // 10.2 — الحادث وعدم المطابقة والإجراء التصحيحي ← الحوادث + الإجراءات التصحيحية
  {
    const incidents = input.incidents.length
    const actions = input.actions.length
    const openActions = input.actions.filter((a) => String(a.status) !== "closed").length
    // ربط نصّي: مصدر الإجراء يحوي رقم وثيقة الحادث.
    const docNos = input.incidents.map((i) => String(i.documentNo ?? "")).filter(Boolean)
    const withAction = docNos.filter((no) => input.actions.some((a) => String(a.source ?? "").includes(no))).length
    let status: ClauseStatus
    let metricAr: string
    let metricEn: string
    if (incidents === 0) {
      status = "not_applicable"
      metricAr = "لا حوادث مسجّلة"
      metricEn = "No recorded incidents"
    } else {
      const coverage = pct(withAction, docNos.length || incidents)
      status = actions === 0 ? "non_compliant" : coverage >= 100 && openActions === 0 ? "compliant" : "partial"
      metricAr = `${incidents} حادث، ${actions} إجراء (${openActions} مفتوح)، تغطية ${coverage}%`
      metricEn = `${incidents} incidents, ${actions} actions (${openActions} open), ${coverage}% covered`
    }
    byClause["10.2"] = { status, auto: true, metricAr, metricEn, updatedAt: latest([...input.incidents, ...input.actions]) }
  }

  // 9.1.1 — المراقبة والقياس (عام) ← التفتيش
  {
    const total = input.inspections.length
    byClause["9.1.1"] = {
      status: total > 0 ? "compliant" : "non_compliant",
      auto: true,
      metricAr: `${total} عملية تفتيش`,
      metricEn: `${total} inspections`,
      updatedAt: latest(input.inspections),
    }
  }

  // 7.5 — المعلومات الموثّقة ← الوثائق (مع ضبط الإصدار وتاريخ المراجعة)
  {
    const total = input.documents.length
    const controlled = input.documents.filter(
      (d) => String(d.version ?? "").trim().length > 0 && String(d.reviewDate ?? "").trim().length > 0,
    ).length
    let status: ClauseStatus = "non_compliant"
    if (total > 0) status = controlled === total ? "compliant" : "partial"
    byClause["7.5"] = {
      status,
      auto: true,
      metricAr: `${total} وثيقة، ${controlled} مضبوطة (إصدار + مراجعة)`,
      metricEn: `${total} documents, ${controlled} controlled (version + review)`,
      updatedAt: latest(input.documents),
    }
  }

  // 8.1 — التخطيط والضبط التشغيلي ← المخالفات (ضبط الانحرافات التشغيلية)
  {
    const total = input.violations.length
    const closed = input.violations.filter(
      (v) => String(v.status) === "closed" || String(v.lifecycle_status) === "archived",
    ).length
    let status: ClauseStatus
    let metricAr: string
    let metricEn: string
    if (total === 0) {
      status = "not_applicable"
      metricAr = "لا مخالفات مسجّلة"
      metricEn = "No recorded violations"
    } else {
      const coverage = pct(closed, total)
      status = coverage >= 80 ? "compliant" : coverage >= 40 ? "partial" : "non_compliant"
      metricAr = `${total} مخالفة، ${closed} مغلقة (${coverage}%)`
      metricEn = `${total} violations, ${closed} closed (${coverage}%)`
    }
    byClause["8.1"] = { status, auto: true, metricAr, metricEn, updatedAt: latest(input.violations) }
  }

  // 9.1 — المراقبة والقياس والتحليل (عام) ← التقارير/المؤشرات (وجود بيانات كافية)
  {
    const anyData =
      input.incidents.length + input.inspections.length + input.risks.length + input.permits.length > 0
    byClause["9.1"] = {
      status: anyData ? "compliant" : "non_compliant",
      auto: true,
      metricAr: anyData ? "بيانات أداء متاحة للتحليل" : "لا بيانات أداء بعد",
      metricEn: anyData ? "Performance data available" : "No performance data yet",
      updatedAt: null,
    }
  }

  // 4.1 و4.2 — سياق المنظمة والأطراف المعنية ← وحدة سياق المنظمة
  {
    const total = input.contextIssues.length
    const internal = input.contextIssues.filter((i) => String(i.kind) === "internal").length
    const external = input.contextIssues.filter((i) => String(i.kind) === "external").length
    const parties = input.contextIssues.filter((i) => String(i.kind) === "interested_party").length
    // مطابق: قضايا داخلية وخارجية وأطراف معنية موثّقة جميعاً؛ جزئي: بعضها فقط.
    let status: ClauseStatus = "non_compliant"
    if (total > 0) {
      const kinds = [internal > 0, external > 0, parties > 0].filter(Boolean).length
      status = kinds >= 3 ? "compliant" : "partial"
    }
    const assessment: ClauseAssessment = {
      status,
      auto: true,
      metricAr: `${total} بند سياق (${internal} داخلي، ${external} خارجي، ${parties} طرف معني)`,
      metricEn: `${total} context items (${internal} internal, ${external} external, ${parties} parties)`,
      updatedAt: latest(input.contextIssues),
    }
    byClause["4.1"] = assessment
    byClause["4.2"] = assessment
  }

  // 5.2 — سياسة السلامة والصحة المهنية ← وحدة السياسة (وجود سياسة سارية معتمدة)
  {
    const total = input.policies.length
    const active = input.policies.filter((p) => String(p.status) === "active")
    const approvedActive = active.filter((p) => String(p.approvedBy ?? "").trim().length > 0).length
    let status: ClauseStatus = "non_compliant"
    if (active.length > 0) status = approvedActive > 0 ? "compliant" : "partial"
    else if (total > 0) status = "partial" // مسودة فقط
    byClause["5.2"] = {
      status,
      auto: true,
      metricAr: total === 0 ? "لا سياسة موثّقة" : `${active.length} سياسة سارية، ${approvedActive} معتمدة`,
      metricEn: total === 0 ? "No documented policy" : `${active.length} active, ${approvedActive} approved`,
      updatedAt: latest(input.policies),
    }
  }

  // 6.2 — أهداف السلامة وخطط تحقيقها ← وحدة الأهداف
  {
    const total = input.objectives.length
    const achieved = input.objectives.filter((o) => String(o.status) === "achieved").length
    const atRisk = input.objectives.filter((o) => String(o.status) === "at_risk").length
    const withPlan = input.objectives.filter(
      (o) => String(o.indicator ?? "").trim().length > 0 && String(o.responsible ?? "").trim().length > 0,
    ).length
    let status: ClauseStatus = "non_compliant"
    if (total > 0) status = withPlan === total && atRisk === 0 ? "compliant" : "partial"
    const assessment: ClauseAssessment = {
      status,
      auto: true,
      metricAr: `${total} هدف، ${achieved} متحقّق، ${atRisk} متعثّر، ${withPlan} بخطة كاملة`,
      metricEn: `${total} objectives, ${achieved} achieved, ${atRisk} at risk, ${withPlan} fully planned`,
      updatedAt: latest(input.objectives),
    }
    byClause["6.2"] = assessment
    byClause["6.2.1"] = assessment
    byClause["6.2.2"] = assessment
  }

  // 6.1.3 و9.1.2 — المتطلبات القانونية وتقييم الالتزام ← السجل القانوني
  {
    const total = input.legalRequirements.length
    const compliant = input.legalRequirements.filter((r) => String(r.complianceStatus) === "compliant").length
    const nonCompliant = input.legalRequirements.filter((r) => String(r.complianceStatus) === "non_compliant").length
    let status: ClauseStatus = "non_compliant"
    if (total > 0) {
      const coverage = pct(compliant, total)
      status = nonCompliant === 0 && coverage >= 80 ? "compliant" : "partial"
    }
    const assessment: ClauseAssessment = {
      status,
      auto: true,
      metricAr: total === 0 ? "لا سجل قانوني بعد" : `${total} متطلب، ${compliant} ملتزم، ${nonCompliant} غير ملتزم`,
      metricEn: total === 0 ? "No legal register yet" : `${total} requirements, ${compliant} compliant, ${nonCompliant} non-compliant`,
      updatedAt: latest(input.legalRequirements),
    }
    byClause["6.1.3"] = assessment
    byClause["9.1.2"] = assessment
  }

  // التجميع على كل البنود.
  const counts: Record<ClauseStatus, number> = {
    compliant: 0,
    partial: 0,
    non_compliant: 0,
    not_applicable: 0,
    not_assessed: 0,
  }
  for (const clause of iso45001Clauses) {
    const status = byClause[clause.id]?.status ?? "not_assessed"
    counts[status] += 1
  }

  // النسبة الإجمالية: على البنود المُقيَّمة والمنطبقة فقط (مطابق=1، جزئي=0.5).
  const assessedCount = counts.compliant + counts.partial + counts.non_compliant
  const overall = assessedCount > 0 ? Math.round(((counts.compliant + counts.partial * 0.5) / assessedCount) * 100) : 0

  return { byClause, overall, counts, assessedCount, totalCount: iso45001Clauses.length }
}
