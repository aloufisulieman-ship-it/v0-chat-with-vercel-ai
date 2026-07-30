// بيانات تجريبية واقعية للوحة التحكم (تُستخدم فقط عندما تكون قاعدة البيانات فارغة).
// مصمّمة لإنتاج مؤشرات أداء غير صفرية لسوق الخضار المركزي.

function ymd(monthsAgo: number, day: number) {
  const n = new Date()
  const dt = new Date(n.getFullYear(), n.getMonth() - monthsAgo, day)
  return dt.toISOString().slice(0, 10)
}

// ---- الحوادث: 23 إجمالي، 7 مفتوحة، 4 أشباه حوادث ----
const incidentTypes = ["injury", "property_damage", "environmental", "fire"]
const severities = ["low", "medium", "high", "critical"]
const trendPlan = [
  { m: 5, c: 4 },
  { m: 4, c: 3 },
  { m: 3, c: 5 },
  { m: 2, c: 2 },
  { m: 1, c: 6 },
  { m: 0, c: 3 },
]
const incidents: any[] = []
let idx = 0
for (const { m, c } of trendPlan) {
  for (let j = 0; j < c; j++) {
    const isNearMiss = incidents.filter((i) => i.type === "near_miss").length < 4 && idx % 5 === 0
    const open = idx < 7
    incidents.push({
      id: idx + 1,
      type: isNearMiss ? "near_miss" : incidentTypes[idx % incidentTypes.length],
      severity: severities[idx % severities.length],
      status: open ? (idx % 2 === 0 ? "open" : "investigating") : "closed",
      incidentDate: ymd(m, 3 + ((idx * 3) % 24)),
      createdAt: ymd(m, 3 + ((idx * 3) % 24)),
    })
    idx++
  }
}

// ---- عمليات التفتيش: 45، متوسط التزام ~87% ----
const complianceCycle = [82, 88, 91, 79, 94, 86, 90, 84, 92]
const inspections = Array.from({ length: 45 }, (_, i) => ({
  id: i + 1,
  compliance: complianceCycle[i % complianceCycle.length],
}))

// ---- التصاريح: 41 إجمالي، 34 نشطة/معتمدة ----
const permits = Array.from({ length: 41 }, (_, i) => ({
  id: i + 1,
  status: i < 34 ? (i % 2 === 0 ? "active" : "approved") : i < 38 ? "expired" : "pending",
}))

// ---- سجل المخاطر: 15، منها 3 عالية (احتمال × أثر ≥ 9) ----
const risks = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  likelihood: i < 3 ? 4 : 2,
  consequence: i < 3 ? 3 : 2,
}))

// ---- الملاحظات: 128 إيجابية + 8 جولة ميدانية ----
const observations = [
  ...Array.from({ length: 128 }, (_, i) => ({ id: i + 1, kind: "positive" })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: 200 + i, kind: "observation" })),
]

// ---- الإجراءات التصحيحية: 14 إجمالي، 9 مفتوحة ----
const openActionRows = [
  { title: "إصلاح إضاءة ممر التحميل الشمالي", assignedTo: "قسم الصيانة", dueDate: ymd(0, 12), priority: "high" },
  { title: "تركيب حواجز أمان لمسار الرافعات الشوكية", assignedTo: "إدارة السلامة", dueDate: ymd(0, 18), priority: "critical" },
  { title: "تجديد طفايات الحريق منتهية الصلاحية", assignedTo: "قسم الطوارئ", dueDate: ymd(0, 22), priority: "high" },
  { title: "تنظيم حركة عربات التوكتوك في البوابة 3", assignedTo: "الأمن", dueDate: ymd(0, 25), priority: "medium" },
  { title: "توفير معدات وقاية شخصية لعمال التفريغ", assignedTo: "المستودع", dueDate: ymd(0, 28), priority: "high" },
  { title: "معالجة تسرب المياه في منطقة الغسيل", assignedTo: "قسم الصيانة", dueDate: ymd(-1, 4), priority: "medium" },
  { title: "تحديث لوحات الإرشاد التحذيرية", assignedTo: "إدارة السلامة", dueDate: ymd(-1, 9), priority: "low" },
  { title: "فحص التوصيلات الكهربائية للبرادات", assignedTo: "قسم الكهرباء", dueDate: ymd(-1, 15), priority: "high" },
  { title: "تدريب العمال على مناولة الأحمال اليدوية", assignedTo: "التدريب", dueDate: ymd(-1, 20), priority: "medium" },
]
const actions = [
  ...openActionRows.map((r, i) => ({ id: i + 1, status: "open", ...r })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: 100 + i,
    title: "إجراء مغلق",
    assignedTo: "إدارة السلامة",
    dueDate: ymd(2, 10 + i),
    priority: "medium",
    status: "closed",
  })),
]

// ---- المخالفات: 18 إجمالي (بعضها قيد المعالجة، بعضها مغلق) ----
const violationRows = [
  { employeeName: "أحمد المطيري", violationType: "عدم ارتداء معدات الوقاية", category: "internal", hrStatus: "open" },
  { employeeName: "شركة النقل السريع", violationType: "قيادة متهورة داخل السوق", category: "external", financeStatus: "open" },
  { employeeName: "خالد العتيبي", violationType: "التدخين في منطقة محظورة", category: "internal", hrStatus: "closed" },
  { employeeName: "مؤسسة التبريد الحديثة", violationType: "تجاوز حمولة الرافعة", category: "external", financeStatus: "in_progress" },
  { employeeName: "سعد القحطاني", violationType: "إعاقة مخارج الطوارئ", category: "internal", hrStatus: "open" },
]
const violations = [
  ...violationRows.map((r, i) => ({
    id: i + 1,
    documentNo: `VIO-2026-${String(i + 1).padStart(3, "0")}`,
    violationDate: ymd(0, 20 - i * 3),
    status: "open",
    ...r,
  })),
  ...Array.from({ length: 13 }, (_, i) => ({
    id: 50 + i,
    documentNo: `VIO-2026-${String(i + 6).padStart(3, "0")}`,
    employeeName: "موظف",
    violationType: "مخالفة سلامة",
    category: i % 2 === 0 ? "internal" : "external",
    hrStatus: i % 3 === 0 ? "closed" : "open",
    financeStatus: i % 3 === 0 ? "closed" : "open",
    status: "open",
    violationDate: ymd(1, 15 - (i % 10)),
  })),
]

export const mockDashboardData = {
  incidents,
  inspections,
  permits,
  risks,
  actions,
  observations,
  violations,
}
