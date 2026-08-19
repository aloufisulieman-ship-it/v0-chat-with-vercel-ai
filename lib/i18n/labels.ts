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
