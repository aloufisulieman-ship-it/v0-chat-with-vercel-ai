// محوّلات القيم المخزّنة في قاعدة البيانات إلى نصوص مترجمة حسب اللغة الحالية.
// تعتمد على دالة t() (من الخادم أو العميل) فلا تكرار لمنطق الترجمة.
// كل محوّل يعيد القيمة الأصلية إن لم يجد ترجمة (أمان أمام قيم غير متوقّعة).

import type { TFunction } from "./translate"

// الحالات (تدعم مفاتيح الوحدات: violations/incidents/permits/inspections...).
export function statusLabel(t: TFunction, value: string): string {
  const key = `dbStatus.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

export function severityLabel(t: TFunction, value: string): string {
  const key = `severity.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

export function incidentTypeLabel(t: TFunction, value: string): string {
  const key = `incidentType.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

export function permitTypeLabel(t: TFunction, value: string): string {
  const key = `permitType.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

export function detectionTypeLabel(t: TFunction, value: string): string {
  const key = `detectionTypes.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

// حالة اكتشاف المراقبة الذكية (new | acknowledged | resolved | false_positive).
// تُعرَّف في namespace status بمفاتيح camelCase، لذا نطبّع snake_case أولاً.
export function detectionStatusLabel(t: TFunction, value: string): string {
  const map: Record<string, string> = {
    new: "status.new",
    acknowledged: "status.acknowledged",
    resolved: "status.resolved",
    false_positive: "status.falsePositive",
  }
  const key = map[value] ?? `status.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

export function departmentLabel(t: TFunction, value: string): string {
  const key = `department.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

export function moduleLabel(t: TFunction, value: string): string {
  const key = `modules.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

// تصنيف المخالفة (internal | external).
export function categoryLabel(t: TFunction, value: string): string {
  const key = `violationCategory.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

// خيار التصنيف الموسّع في النموذج (internal | external).
export function categoryOptionLabel(t: TFunction, value: string): string {
  const key = `categoryOption.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

// الإجراء الداخلي — القيمة مخزّنة بالعربية، نترجمها للعرض فقط.
export function internalActionLabel(t: TFunction, value: string): string {
  const key = `internalAction.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

// نوع المخالفة — القيمة مخزّنة بالعربية، نترجمها للعرض فقط.
export function violationTypeLabel(t: TFunction, value: string): string {
  const key = `violationTypes.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

// مولّد مساعد عام: يترجم عبر مساحة محددة مع الرجوع إلى القيمة الأصلية.
function makeLabeler(ns: string) {
  return (t: TFunction, value: string): string => {
    const key = `${ns}.${value}`
    const translated = t(key)
    return translated === key ? value : translated
  }
}

// خيارات نموذج الحادثة (قيم ثابتة) وأنواع الحوادث المخزّنة بالعربية.
export const incidentSeverityLabel = makeLabeler("incidentSeverity")
export const incidentStatusOptLabel = makeLabeler("incidentStatusOpt")
export const partyAffiliationLabel = makeLabeler("partyAffiliation")
export const partyInjuryLabel = makeLabeler("partyInjury")
export const partyHospitalizedLabel = makeLabeler("partyHospitalized")
export const incidentTypeCatalogLabel = makeLabeler("incidentTypes")

// حالة مسار الإحالة (HR / المالية): pending | in_review | closed.
export const refStatusLabel = makeLabeler("refStatus")
