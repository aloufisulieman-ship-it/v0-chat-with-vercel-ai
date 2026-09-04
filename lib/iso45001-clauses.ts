// خريطة كاملة لبنود معيار ISO 45001:2018 (البنود 4 إلى 10 بجميع بنودها الفرعية)
// بالعربية والإنجليزية. مصدر واحد تعتمده صفحة المطابقة /compliance وشارات البنود
// على صفحات الوحدات. البيانات ثابتة (معيار دولي)، فلا تمرّ عبر ملفات القاموس.

export type ClauseStatus =
  | "compliant" // مطابق
  | "partial" // مطابق جزئياً
  | "non_compliant" // غير مطابق
  | "not_applicable" // لا ينطبق
  | "not_assessed" // لم يُقيَّم بعد (بانتظار وحدة/إدخال يدوي)

export type IsoClause = {
  id: string // رقم البند، مثل "6.1.2"
  section: number // القسم الرئيسي 4..10
  level: 1 | 2 | 3 | 4 // عمق التداخل للعرض الهرمي
  ar: string
  en: string
}

// القائمة الكاملة بالترتيب الهرمي.
export const iso45001Clauses: IsoClause[] = [
  // 4 — سياق المنظمة
  { id: "4", section: 4, level: 1, ar: "سياق المنظمة", en: "Context of the organization" },
  { id: "4.1", section: 4, level: 2, ar: "فهم المنظمة وسياقها", en: "Understanding the organization and its context" },
  {
    id: "4.2",
    section: 4,
    level: 2,
    ar: "فهم احتياجات وتوقعات العمال والأطراف المعنية الأخرى",
    en: "Understanding the needs and expectations of workers and other interested parties",
  },
  {
    id: "4.3",
    section: 4,
    level: 2,
    ar: "تحديد نطاق نظام إدارة السلامة والصحة المهنية",
    en: "Determining the scope of the OH&S management system",
  },
  { id: "4.4", section: 4, level: 2, ar: "نظام إدارة السلامة والصحة المهنية", en: "OH&S management system" },

  // 5 — القيادة ومشاركة العمال
  { id: "5", section: 5, level: 1, ar: "القيادة ومشاركة العمال", en: "Leadership and worker participation" },
  { id: "5.1", section: 5, level: 2, ar: "القيادة والالتزام", en: "Leadership and commitment" },
  { id: "5.2", section: 5, level: 2, ar: "سياسة السلامة والصحة المهنية", en: "OH&S policy" },
  {
    id: "5.3",
    section: 5,
    level: 2,
    ar: "الأدوار والمسؤوليات والصلاحيات التنظيمية",
    en: "Organizational roles, responsibilities and authorities",
  },
  { id: "5.4", section: 5, level: 2, ar: "التشاور ومشاركة العمال", en: "Consultation and participation of workers" },

  // 6 — التخطيط
  { id: "6", section: 6, level: 1, ar: "التخطيط", en: "Planning" },
  { id: "6.1", section: 6, level: 2, ar: "إجراءات معالجة المخاطر والفرص", en: "Actions to address risks and opportunities" },
  { id: "6.1.1", section: 6, level: 3, ar: "عام", en: "General" },
  {
    id: "6.1.2",
    section: 6,
    level: 3,
    ar: "تحديد المخاطر وتقييم المخاطر والفرص",
    en: "Hazard identification and assessment of risks and opportunities",
  },
  { id: "6.1.2.1", section: 6, level: 4, ar: "تحديد المخاطر", en: "Hazard identification" },
  {
    id: "6.1.2.2",
    section: 6,
    level: 4,
    ar: "تقييم مخاطر السلامة والصحة المهنية والمخاطر الأخرى",
    en: "Assessment of OH&S risks and other risks to the OH&S management system",
  },
  {
    id: "6.1.2.3",
    section: 6,
    level: 4,
    ar: "تقييم فرص السلامة والصحة المهنية والفرص الأخرى",
    en: "Assessment of OH&S opportunities and other opportunities",
  },
  {
    id: "6.1.3",
    section: 6,
    level: 3,
    ar: "تحديد المتطلبات القانونية والمتطلبات الأخرى",
    en: "Determination of legal requirements and other requirements",
  },
  { id: "6.1.4", section: 6, level: 3, ar: "تخطيط الإجراءات", en: "Planning action" },
  {
    id: "6.2",
    section: 6,
    level: 2,
    ar: "أهداف السلامة والصحة المهنية وتخطيط تحقيقها",
    en: "OH&S objectives and planning to achieve them",
  },
  { id: "6.2.1", section: 6, level: 3, ar: "أهداف السلامة والصحة المهنية", en: "OH&S objectives" },
  {
    id: "6.2.2",
    section: 6,
    level: 3,
    ar: "تخطيط تحقيق أهداف السلامة والصحة المهنية",
    en: "Planning to achieve OH&S objectives",
  },

  // 7 — الدعم
  { id: "7", section: 7, level: 1, ar: "الدعم", en: "Support" },
  { id: "7.1", section: 7, level: 2, ar: "الموارد", en: "Resources" },
  { id: "7.2", section: 7, level: 2, ar: "الكفاءة", en: "Competence" },
  { id: "7.3", section: 7, level: 2, ar: "الوعي", en: "Awareness" },
  { id: "7.4", section: 7, level: 2, ar: "التواصل", en: "Communication" },
  { id: "7.4.1", section: 7, level: 3, ar: "عام", en: "General" },
  { id: "7.4.2", section: 7, level: 3, ar: "التواصل الداخلي", en: "Internal communication" },
  { id: "7.4.3", section: 7, level: 3, ar: "التواصل الخارجي", en: "External communication" },
  { id: "7.5", section: 7, level: 2, ar: "المعلومات الموثّقة", en: "Documented information" },
  { id: "7.5.1", section: 7, level: 3, ar: "عام", en: "General" },
  { id: "7.5.2", section: 7, level: 3, ar: "الإنشاء والتحديث", en: "Creating and updating" },
  { id: "7.5.3", section: 7, level: 3, ar: "ضبط المعلومات الموثّقة", en: "Control of documented information" },

  // 8 — التشغيل
  { id: "8", section: 8, level: 1, ar: "التشغيل", en: "Operation" },
  { id: "8.1", section: 8, level: 2, ar: "التخطيط والضبط التشغيلي", en: "Operational planning and control" },
  { id: "8.1.1", section: 8, level: 3, ar: "عام", en: "General" },
  {
    id: "8.1.2",
    section: 8,
    level: 3,
    ar: "إزالة المخاطر وتقليل مخاطر السلامة والصحة المهنية",
    en: "Eliminating hazards and reducing OH&S risks",
  },
  { id: "8.1.3", section: 8, level: 3, ar: "إدارة التغيير", en: "Management of change" },
  { id: "8.1.4", section: 8, level: 3, ar: "المشتريات", en: "Procurement" },
  { id: "8.1.4.1", section: 8, level: 4, ar: "عام", en: "General" },
  { id: "8.1.4.2", section: 8, level: 4, ar: "المقاولون", en: "Contractors" },
  { id: "8.1.4.3", section: 8, level: 4, ar: "الإسناد الخارجي", en: "Outsourcing" },
  { id: "8.2", section: 8, level: 2, ar: "التأهب والاستجابة للطوارئ", en: "Emergency preparedness and response" },

  // 9 — تقييم الأداء
  { id: "9", section: 9, level: 1, ar: "تقييم الأداء", en: "Performance evaluation" },
  {
    id: "9.1",
    section: 9,
    level: 2,
    ar: "المراقبة والقياس والتحليل وتقييم الأداء",
    en: "Monitoring, measurement, analysis and performance evaluation",
  },
  { id: "9.1.1", section: 9, level: 3, ar: "عام", en: "General" },
  { id: "9.1.2", section: 9, level: 3, ar: "تقييم الالتزام", en: "Evaluation of compliance" },
  { id: "9.2", section: 9, level: 2, ar: "التدقيق الداخلي", en: "Internal audit" },
  { id: "9.2.1", section: 9, level: 3, ar: "عام", en: "General" },
  { id: "9.2.2", section: 9, level: 3, ar: "برنامج التدقيق الداخلي", en: "Internal audit programme" },
  { id: "9.3", section: 9, level: 2, ar: "مراجعة الإدارة", en: "Management review" },

  // 10 — التحسين
  { id: "10", section: 10, level: 1, ar: "التحسين", en: "Improvement" },
  { id: "10.1", section: 10, level: 2, ar: "عام", en: "General" },
  {
    id: "10.2",
    section: 10,
    level: 2,
    ar: "الحادث وعدم المطابقة والإجراء التصحيحي",
    en: "Incident, nonconformity and corrective action",
  },
  { id: "10.3", section: 10, level: 2, ar: "التحسين المستمر", en: "Continual improvement" },
]

// فهرس سريع بالمعرّف.
export const clauseById: Record<string, IsoClause> = Object.fromEntries(iso45001Clauses.map((c) => [c.id, c]))

// عناوين الأقسام الرئيسية السبعة (4..10) للاستخدام في التجميع.
export const clauseSections: { section: number; ar: string; en: string }[] = iso45001Clauses
  .filter((c) => c.level === 1)
  .map((c) => ({ section: c.section, ar: c.ar, en: c.en }))

// ربط كل وحدة قائمة موجودة ببنود المعيار التي توفّر لها دليلاً فعلياً في النظام.
// (المفتاح = مفتاح الوحدة/المسار كما في القائمة الجانبية.)
export const moduleClauseLinks: Record<string, string[]> = {
  risks: ["6.1.2"],
  permits: ["8.1.2"],
  training: ["7.2", "7.3"],
  incidents: ["10.2"],
  actions: ["10.2"],
  inspections: ["9.1.1"],
  documents: ["7.5"],
  violations: ["8.1"],
  reports: ["9.1"],
  // وحدات المرحلة الثانية (مبنيّة فعلياً الآن).
  context: ["4.1", "4.2", "4.3", "4.4"],
  policy: ["5.2"],
  "legal-register": ["6.1.3", "9.1.2"],
  objectives: ["6.2", "6.2.1", "6.2.2"],
}

// وحدات مخطّط إنشاؤها لاحقاً والبنود التي ستغطّيها — تُعرَض كدليل «مخطّط» في لوحة
// المطابقة قبل أن تُبنى فعلياً.
export const plannedModuleClauseLinks: Record<string, string[]> = {
  consultation: ["5.4"],
  emergency: ["8.2"],
  contractors: ["8.1.4", "8.1.4.2"],
  "management-review": ["9.3"],
  "internal-audit": ["9.2"],
}

// أسماء الوحدات (الموجودة والمخطّطة) بالعربية والإنجليزية — لعرض روابط الأدلة.
export const moduleNames: Record<string, { ar: string; en: string }> = {
  risks: { ar: "تقييم المخاطر", en: "Risk assessment" },
  permits: { ar: "تصاريح العمل", en: "Work permits" },
  training: { ar: "التدريب", en: "Training" },
  incidents: { ar: "الحوادث", en: "Incidents" },
  actions: { ar: "الإجراءات التصحيحية", en: "Corrective actions" },
  inspections: { ar: "التفتيش", en: "Inspections" },
  documents: { ar: "الوثائق", en: "Documents" },
  violations: { ar: "المخالفات", en: "Violations" },
  reports: { ar: "التقارير", en: "Reports" },
  context: { ar: "سياق المنظمة", en: "Organization context" },
  policy: { ar: "سياسة السلامة", en: "OH&S policy" },
  consultation: { ar: "تشاور العمال", en: "Worker consultation" },
  "legal-register": { ar: "السجل القانوني", en: "Legal register" },
  objectives: { ar: "الأهداف والخطط", en: "Objectives & plans" },
  emergency: { ar: "التأهب للطوارئ", en: "Emergency preparedness" },
  contractors: { ar: "المقاولون والمشتريات", en: "Contractors & procurement" },
  "management-review": { ar: "مراجعة الإدارة", en: "Management review" },
  "internal-audit": { ar: "التدقيق الداخلي", en: "Internal audit" },
}

export type ClauseEvidenceLink = { module: string; href: string; planned: boolean }

// مسار الصفحة لكل وحدة (الموجودة والمخطّطة).
const moduleHref: Record<string, string> = {
  risks: "/risks",
  permits: "/permits",
  training: "/training",
  incidents: "/incidents",
  actions: "/actions",
  inspections: "/inspections",
  documents: "/documents",
  violations: "/violations",
  reports: "/reports",
  context: "/context",
  policy: "/policy",
  consultation: "/consultation",
  "legal-register": "/legal-register",
  objectives: "/objectives",
  emergency: "/emergency",
  contractors: "/contractors",
  "management-review": "/management-review",
  "internal-audit": "/internal-audit",
}

// كل الأدلة المرتبطة ببند معيّن (تشمل تطابق البند الأب: دليل 6.1.2 يخدم 6.1.2.1 أيضاً).
export function clauseEvidence(clauseId: string): ClauseEvidenceLink[] {
  const links: ClauseEvidenceLink[] = []
  const matches = (linked: string) => clauseId === linked || clauseId.startsWith(linked + ".")
  for (const [module, ids] of Object.entries(moduleClauseLinks)) {
    if (ids.some(matches)) links.push({ module, href: moduleHref[module] ?? "/", planned: false })
  }
  for (const [module, ids] of Object.entries(plannedModuleClauseLinks)) {
    if (ids.some(matches)) links.push({ module, href: moduleHref[module] ?? "/", planned: true })
  }
  return links
}

// النص المرجعي المعروض في الشارة أعلى كل صفحة وحدة.
export function formatClauseRef(id: string): string {
  return `ISO 45001 – ${id}`
}
