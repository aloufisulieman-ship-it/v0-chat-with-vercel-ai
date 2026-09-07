/**
 * Seed: 10 تصاريح عمل واقعية لورشة صيانة (PTW-004 … PTW-013)
 * موزّعة على يناير–أغسطس 2026 بتواريخ ثابتة، بحالات نهائية منطقية
 * (لا يوجد "ساري" أو "بانتظار الاعتماد" في الماضي).
 *
 * التشغيل:
 *   node --env-file=/vercel/share/.env.project scripts/seed-workshop-permits.ts
 *
 * يمسح كل تصاريح المؤسسة الحالية (+ تواقيعها وسجلات تتبعها) ثم يزرع العشرة.
 */
import pg from "pg"

const { Client } = pg

const ORG_ID = "org_2b4332cb-c0ec-4854-8d3c-43c303f7c347"
// المستخدم المالك للسجلات (مدير المؤسسة).
const OWNER_USER_ID = "Ws9FVZcNZqtqU2EDCVFLWQOS4wa9G5wI"

// أسماء الموقّعين الرسميين الأربعة الثابتة (مطابقة لـ lib/permit-signatories.ts).
const NAMES = {
  requester: "حسين العوفي", // مسؤول الورشة
  supervisor: "محمد الصبحي", // مشرف الورشة (المُصدر + مشرف الموقع)
  worker: "محمد الصبحي", // منفذ العمل (توقيع الإغلاق)
  safety: "نصر السعدي", // مشرف السلامة
  manager: "سليمان العوفي", // مسؤول السلامة (الاعتماد النهائي)
  receiver: "سليمان العوفي", // مسؤول السلامة (توقيع إغلاق)
}

// توقيع كصورة SVG مضمّنة (data URL) تُعرض في شاشة التفاصيل.
function sig(name: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="90" viewBox="0 0 260 90">` +
    `<rect width="260" height="90" fill="#ffffff"/>` +
    `<path d="M18 62 C 45 20, 70 20, 90 55 S 140 80, 165 45 S 210 20, 242 50" fill="none" stroke="#1e3a8a" stroke-width="2.4" stroke-linecap="round"/>` +
    `<text x="130" y="82" font-family="Segoe UI, Tahoma, sans-serif" font-size="12" fill="#334155" text-anchor="middle">${name}</text>` +
    `</svg>`
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg)
}

type Sig = { role: string; signerName: string; signedAt: string }
type Audit = { action: string; actorName: string; note: string; createdAt: string }

interface Seed {
  documentNo: string
  type: string
  title: string
  location: string
  startAt: string
  endAt: string
  durationHours: number
  riskLevel: "medium" | "high" | "critical"
  status: "closed" | "rejected" | "expired"
  workDescription: string
  contractorName: string
  supervisorName: string
  workersCount: number
  checklistAnswers: Record<string, boolean>
  gasTestReadings?: Record<string, unknown>
  isolationLOTO?: Record<string, unknown>
  closedAt?: string | null
  closedBy?: string
  siteConditionAfter?: string
  areaEvacuated?: boolean
  archivedAt?: string | null
  approvedBy?: string
  approvedAt?: string | null
  rejectionReason?: string
  signatures: Sig[]
  audit: Audit[]
}

// قوائم فحص كاملة (كل البنود مطابقة) حسب النوع.
const CHECK = {
  common: { ppe: true, area_barricaded: true, toolbox_talk: true, emergency_plan: true },
  hot_work: { fire_extinguisher: true, fire_watch: true, combustibles_removed: true, gas_free: true },
  lifting: { crane_cert: true, rigging_inspected: true, load_chart: true, exclusion_zone: true },
  work_at_height: { harness: true, anchor_points: true, scaffold_tag: true, drop_zone: true },
  electrical: { loto_applied: true, zero_energy: true, insulated_tools: true, arc_flash_ppe: true },
  confined_space: { gas_test_done: true, attendant: true, ventilation: true, rescue_plan: true },
  cold_work: { tools_inspected: true, housekeeping: true },
}

// تواقيع اعتماد كاملة لتصريح مغلق (6 تواقيع).
function fullClosedSigs(start: string, mid: string, end: string, close: string): Sig[] {
  return [
    { role: "requester", signerName: NAMES.requester, signedAt: start },
    { role: "issuer", signerName: NAMES.supervisor, signedAt: start },
    { role: "safety", signerName: NAMES.safety, signedAt: mid },
    { role: "approver", signerName: NAMES.manager, signedAt: mid },
    { role: "closeIssuer", signerName: NAMES.worker, signedAt: close },
    { role: "closeReceiver", signerName: NAMES.receiver, signedAt: end },
  ]
}

const SEEDS: Seed[] = [
  // PTW-004 — عمل ساخن
  {
    documentNo: "PTW-004",
    type: "hot_work",
    title: "لحام وتقوية هيكل حامل رافعة شوكية",
    location: "ورشة الصيانة – ركن اللحام",
    startAt: "2026-01-11 08:00:00",
    endAt: "2026-01-11 12:00:00",
    durationHours: 4,
    riskLevel: "high",
    status: "closed",
    workDescription: "لحام وتقوية نقاط الإجهاد في هيكل حامل الرافعة الشوكية باستخدام لحام القوس الكهربائي.",
    contractorName: "قسم الصيانة الداخلي",
    supervisorName: NAMES.supervisor,
    workersCount: 3,
    checklistAnswers: { ...CHECK.common, ...CHECK.hot_work },
    gasTestReadings: { o2: "20.9%", lel: "0% LEL", readings: "قياس قبل البدء 07:45 — لا أبخرة قابلة للاشتعال" },
    closedAt: "2026-01-11 12:40:00",
    closedBy: NAMES.worker,
    siteConditionAfter: "تم تبريد نقاط اللحام ومراقبة الحريق 30 دقيقة، الموقع نظيف وآمن.",
    areaEvacuated: false,
    approvedBy: NAMES.manager,
    approvedAt: "2026-01-11 07:50:00",
    signatures: fullClosedSigs("2026-01-11 07:40:00", "2026-01-11 07:50:00", "2026-01-11 12:40:00", "2026-01-11 12:30:00"),
    audit: [
      { action: "created", actorName: NAMES.requester, note: "طلب تصريح عمل ساخن للحام حامل الرافعة", createdAt: "2026-01-11 07:30:00" },
      { action: "approved", actorName: NAMES.manager, note: "اعتماد بعد فحص المنطقة وتوفر مراقب الحريق", createdAt: "2026-01-11 07:50:00" },
      { action: "closed", actorName: NAMES.worker, note: "إنهاء العمل وإغلاق التصريح بعد مراقبة الحريق", createdAt: "2026-01-11 12:40:00" },
    ],
  },
  // PTW-005 — عمل ساخن
  {
    documentNo: "PTW-005",
    type: "hot_work",
    title: "إصلاح البوابة – قص ولحام المفصلات والإطار",
    location: "البوابة الرئيسية للورشة",
    startAt: "2026-02-05 13:00:00",
    endAt: "2026-02-05 17:00:00",
    durationHours: 4,
    riskLevel: "high",
    status: "closed",
    workDescription: "قص المفصلات التالفة ولحام مفصلات وإطار جديد للبوابة الرئيسية.",
    contractorName: "قسم الصيانة الداخلي",
    supervisorName: NAMES.supervisor,
    workersCount: 2,
    checklistAnswers: { ...CHECK.common, ...CHECK.hot_work },
    gasTestReadings: { o2: "20.9%", lel: "0% LEL", readings: "قياس قبل البدء 12:45 — المنطقة مفتوحة جيدة التهوية" },
    closedAt: "2026-02-05 17:30:00",
    closedBy: NAMES.worker,
    siteConditionAfter: "إتمام اللحام ومراقبة الحريق 30 دقيقة، البوابة تعمل والموقع آمن.",
    areaEvacuated: false,
    approvedBy: NAMES.manager,
    approvedAt: "2026-02-05 12:50:00",
    signatures: fullClosedSigs("2026-02-05 12:40:00", "2026-02-05 12:50:00", "2026-02-05 17:30:00", "2026-02-05 17:20:00"),
    audit: [
      { action: "created", actorName: NAMES.requester, note: "طلب تصريح عمل ساخن لإصلاح البوابة", createdAt: "2026-02-05 12:30:00" },
      { action: "approved", actorName: NAMES.manager, note: "اعتماد مع اشتراط مراقبة الحريق بعد العمل", createdAt: "2026-02-05 12:50:00" },
      { action: "closed", actorName: NAMES.worker, note: "إغلاق بعد مراقبة الحريق 30 دقيقة", createdAt: "2026-02-05 17:30:00" },
    ],
  },
  // PTW-006 — رفع وأوناش
  {
    documentNo: "PTW-006",
    type: "lifting",
    title: "رفع وتركيب درفة البوابة الجديدة",
    location: "البوابة الرئيسية للورشة",
    startAt: "2026-02-06 07:30:00",
    endAt: "2026-02-06 10:30:00",
    durationHours: 3,
    riskLevel: "high",
    status: "closed",
    workDescription: "رفع درفة البوابة الجديدة بونش وتركيبها على المفصلات الملحومة.",
    contractorName: "شركة الأوناش المتحدة",
    supervisorName: NAMES.supervisor,
    workersCount: 4,
    checklistAnswers: { ...CHECK.common, ...CHECK.lifting },
    isolationLOTO: { points: [], locksApplied: 0, tagsApplied: 0, note: "لا يلزم عزل طاقة — عملية رفع ميكانيكية" },
    closedAt: "2026-02-06 10:50:00",
    closedBy: NAMES.worker,
    siteConditionAfter: "تم تركيب الدرفة واختبار الحركة، منطقة الرفع مفتوحة والموقع آمن.",
    areaEvacuated: true,
    approvedBy: NAMES.manager,
    approvedAt: "2026-02-06 07:20:00",
    signatures: fullClosedSigs("2026-02-06 07:10:00", "2026-02-06 07:20:00", "2026-02-06 10:50:00", "2026-02-06 10:40:00"),
    audit: [
      { action: "created", actorName: NAMES.requester, note: "طلب تصريح رفع لتركيب درفة البوابة", createdAt: "2026-02-06 07:00:00" },
      { action: "approved", actorName: NAMES.manager, note: "اعتماد بعد التحقق من شهادة الونش وخطة الرفع", createdAt: "2026-02-06 07:20:00" },
      { action: "closed", actorName: NAMES.worker, note: "إتمام التركيب وإغلاق التصريح", createdAt: "2026-02-06 10:50:00" },
    ],
  },
  // PTW-007 — عمل على ارتفاع
  {
    documentNo: "PTW-007",
    type: "work_at_height",
    title: "تركيب مكيف سبليت على ارتفاع 3.2 م",
    location: "مكتب الورشة – الجدار الخارجي",
    startAt: "2026-03-18 09:00:00",
    endAt: "2026-03-18 14:00:00",
    durationHours: 5,
    riskLevel: "high",
    status: "closed",
    workDescription: "تثبيت الوحدة الخارجية للمكيف على الجدار الخارجي على ارتفاع 3.2 م باستخدام سقالة معتمدة.",
    contractorName: "مؤسسة التكييف الحديثة",
    supervisorName: NAMES.supervisor,
    workersCount: 2,
    checklistAnswers: { ...CHECK.common, ...CHECK.work_at_height },
    closedAt: "2026-03-18 14:15:00",
    closedBy: NAMES.worker,
    siteConditionAfter: "تم التركيب وفك السقالة وتأمين المنطقة، الموقع آمن.",
    areaEvacuated: false,
    approvedBy: NAMES.manager,
    approvedAt: "2026-03-18 08:50:00",
    signatures: fullClosedSigs("2026-03-18 08:40:00", "2026-03-18 08:50:00", "2026-03-18 14:15:00", "2026-03-18 14:05:00"),
    audit: [
      { action: "created", actorName: NAMES.requester, note: "طلب تصريح عمل على ارتفاع لتركيب المكيف", createdAt: "2026-03-18 08:30:00" },
      { action: "approved", actorName: NAMES.manager, note: "اعتماد بعد فحص السقالة وأحزمة الأمان", createdAt: "2026-03-18 08:50:00" },
      { action: "closed", actorName: NAMES.worker, note: "إتمام التركيب وإغلاق التصريح", createdAt: "2026-03-18 14:15:00" },
    ],
  },
  // PTW-008 — كهربائي / LOTO
  {
    documentNo: "PTW-008",
    type: "electrical",
    title: "تمديد وتوصيل دائرة كهربائية مستقلة للمكيف",
    location: "مكتب الورشة – لوحة التوزيع الفرعية",
    startAt: "2026-03-18 14:00:00",
    endAt: "2026-03-18 17:00:00",
    durationHours: 3,
    riskLevel: "critical",
    status: "closed",
    workDescription: "تمديد دائرة كهربائية مستقلة بقاطع مخصص للمكيف الجديد من لوحة التوزيع الفرعية.",
    contractorName: "مؤسسة التكييف الحديثة",
    supervisorName: NAMES.supervisor,
    workersCount: 1,
    checklistAnswers: { ...CHECK.common, ...CHECK.electrical },
    isolationLOTO: {
      points: ["قاطع لوحة التوزيع الفرعية للمكتب"],
      locksApplied: 1,
      tagsApplied: 1,
      lockNumber: "LOTO-014",
      note: "عزل اللوحة وقفلها ببطاقة LOTO-014 والتأكد من انعدام الجهد قبل العمل.",
    },
    closedAt: "2026-03-18 17:20:00",
    closedBy: NAMES.worker,
    siteConditionAfter: "إزالة القفل والبطاقة بعد إتمام العمل وإعادة التغذية واختبار الدائرة بنجاح.",
    areaEvacuated: false,
    approvedBy: NAMES.manager,
    approvedAt: "2026-03-18 13:50:00",
    signatures: fullClosedSigs("2026-03-18 13:40:00", "2026-03-18 13:50:00", "2026-03-18 17:20:00", "2026-03-18 17:10:00"),
    audit: [
      { action: "created", actorName: NAMES.requester, note: "طلب تصريح كهربائي مع عزل طاقة LOTO", createdAt: "2026-03-18 13:30:00" },
      { action: "approved", actorName: NAMES.manager, note: "اعتماد بعد تطبيق العزل LOTO-014 والتحقق من انعدام الجهد", createdAt: "2026-03-18 13:50:00" },
      { action: "closed", actorName: NAMES.worker, note: "إزالة العزل وإغلاق التصريح بعد اختبار الدائرة", createdAt: "2026-03-18 17:20:00" },
    ],
  },
  // PTW-009 — عمل عام (متعدد الأيام + تعليق/استئناف)
  {
    documentNo: "PTW-009",
    type: "cold_work",
    title: "تعديل وبناء داخلي – تكسير جدار وبناء قاطع",
    location: "مكتب الورشة – القسم الإداري",
    startAt: "2026-04-12 07:00:00",
    endAt: "2026-04-14 15:00:00",
    durationHours: 24,
    riskLevel: "medium",
    status: "closed",
    workDescription: "تكسير جدار داخلي وبناء قاطع جديد لإعادة تقسيم القسم الإداري على مدى ثلاثة أيام.",
    contractorName: "مقاول البناء والتشطيبات",
    supervisorName: NAMES.supervisor,
    workersCount: 5,
    checklistAnswers: { ...CHECK.common, ...CHECK.cold_work },
    closedAt: "2026-04-14 15:30:00",
    closedBy: NAMES.worker,
    siteConditionAfter: "إتمام القاطع وتنظيف الموقع وإزالة المخلفات، الموقع آمن وجاهز للتشطيب.",
    areaEvacuated: false,
    approvedBy: NAMES.manager,
    approvedAt: "2026-04-12 06:50:00",
    signatures: fullClosedSigs("2026-04-12 06:40:00", "2026-04-12 06:50:00", "2026-04-14 15:30:00", "2026-04-14 15:20:00"),
    audit: [
      { action: "created", actorName: NAMES.requester, note: "طلب تصريح عمل عام لتعديل داخلي (3 أيام)", createdAt: "2026-04-12 06:30:00" },
      { action: "approved", actorName: NAMES.manager, note: "اعتماد العمل متعدد الأيام", createdAt: "2026-04-12 06:50:00" },
      { action: "suspended", actorName: NAMES.safety, note: "تعليق مؤقت — اكتشاف كابل كهربائي حيّ داخل الجدار أثناء التكسير", createdAt: "2026-04-13 09:20:00" },
      { action: "resumed", actorName: NAMES.safety, note: "استئناف العمل بعد عزل الكابل والتأكد من انعدام الجهد", createdAt: "2026-04-13 11:00:00" },
      { action: "closed", actorName: NAMES.worker, note: "إتمام البناء وإغلاق التصريح", createdAt: "2026-04-14 15:30:00" },
    ],
  },
  // PTW-010 — عمل عام (مؤرشف)
  {
    documentNo: "PTW-010",
    type: "cold_work",
    title: "تركيب أسقف مستعارة وإنارة LED",
    location: "مكتب الورشة – السقف الداخلي",
    startAt: "2026-05-20 08:00:00",
    endAt: "2026-05-20 15:00:00",
    durationHours: 7,
    riskLevel: "medium",
    status: "closed",
    workDescription: "تركيب ألواح أسقف مستعارة ووحدات إنارة LED في مكتب الورشة.",
    contractorName: "مقاول التشطيبات الداخلية",
    supervisorName: NAMES.supervisor,
    workersCount: 3,
    checklistAnswers: { ...CHECK.common, ...CHECK.cold_work },
    closedAt: "2026-05-20 15:20:00",
    closedBy: NAMES.worker,
    siteConditionAfter: "إتمام التركيب واختبار الإنارة وتنظيف الموقع.",
    areaEvacuated: false,
    archivedAt: "2026-06-01 09:00:00",
    approvedBy: NAMES.manager,
    approvedAt: "2026-05-20 07:50:00",
    signatures: fullClosedSigs("2026-05-20 07:40:00", "2026-05-20 07:50:00", "2026-05-20 15:20:00", "2026-05-20 15:10:00"),
    audit: [
      { action: "created", actorName: NAMES.requester, note: "طلب تصريح عمل عام لتركيب الأسقف والإنارة", createdAt: "2026-05-20 07:30:00" },
      { action: "approved", actorName: NAMES.manager, note: "اعتماد العمل", createdAt: "2026-05-20 07:50:00" },
      { action: "closed", actorName: NAMES.worker, note: "إتمام العمل وإغلاق التصريح", createdAt: "2026-05-20 15:20:00" },
      { action: "archived", actorName: NAMES.manager, note: "أرشفة التصريح بعد اكتمال المراجعة", createdAt: "2026-06-01 09:00:00" },
    ],
  },
  // PTW-011 — أماكن مغلقة
  {
    documentNo: "PTW-011",
    type: "confined_space",
    title: "تنظيف وفحص خزان الديزل من الداخل",
    location: "الورشة – خزان تعبئة الديزل",
    startAt: "2026-06-09 06:30:00",
    endAt: "2026-06-09 11:00:00",
    durationHours: 4,
    riskLevel: "critical",
    status: "closed",
    workDescription: "دخول خزان الديزل لتنظيف الرواسب والفحص الداخلي مع مراقب خارجي وخطة إنقاذ.",
    contractorName: "شركة خدمات الخزانات المتخصصة",
    supervisorName: NAMES.supervisor,
    workersCount: 3,
    checklistAnswers: { ...CHECK.common, ...CHECK.confined_space },
    gasTestReadings: {
      o2: "20.9%",
      lel: "0% LEL",
      h2s: "0 ppm",
      co: "0 ppm",
      schedule: "قياس قبل الدخول 06:15 ثم إعادة كل ساعة: 07:15 / 08:15 / 09:15 / 10:15",
    },
    closedAt: "2026-06-09 11:20:00",
    closedBy: NAMES.worker,
    siteConditionAfter: "خروج جميع العاملين، إغلاق فتحة الخزان وتأمينها، الموقع آمن.",
    areaEvacuated: true,
    approvedBy: NAMES.manager,
    approvedAt: "2026-06-09 06:20:00",
    signatures: fullClosedSigs("2026-06-09 06:10:00", "2026-06-09 06:20:00", "2026-06-09 11:20:00", "2026-06-09 11:10:00"),
    audit: [
      { action: "created", actorName: NAMES.requester, note: "طلب تصريح دخول أماكن محصورة لخزان الديزل", createdAt: "2026-06-09 06:00:00" },
      { action: "approved", actorName: NAMES.manager, note: "اعتماد بعد فحص الغازات وتعيين مراقب وخطة إنقاذ", createdAt: "2026-06-09 06:20:00" },
      { action: "closed", actorName: NAMES.worker, note: "إتمام التنظيف والفحص وإغلاق الخزان والتصريح", createdAt: "2026-06-09 11:20:00" },
    ],
  },
  // PTW-012 — تداول مواد كيميائية (مرفوض)
  {
    documentNo: "PTW-012",
    type: "cold_work",
    title: "نقل وتخزين الزيوت والديزل ومواد الطلاء",
    location: "مخزن الورشة ومنطقة التزويد بالوقود",
    startAt: "2026-07-15 08:00:00",
    endAt: "2026-07-15 11:00:00",
    durationHours: 3,
    riskLevel: "medium",
    status: "rejected",
    workDescription: "نقل وتخزين براميل الزيوت والديزل ومواد الطلاء إلى المخزن ومنطقة التزويد.",
    contractorName: "قسم المستودعات الداخلي",
    supervisorName: NAMES.supervisor,
    workersCount: 2,
    checklistAnswers: { ...CHECK.common },
    approvedBy: NAMES.manager,
    approvedAt: null,
    rejectionReason:
      "عدم توفر أوراق بيانات السلامة (MSDS) لمادتين، وعدم جاهزية معدات احتواء الانسكاب. يُعاد تقديم الطلب بعد استيفاء المتطلبات.",
    signatures: [
      { role: "requester", signerName: NAMES.requester, signedAt: "2026-07-15 07:30:00" },
      { role: "issuer", signerName: NAMES.supervisor, signedAt: "2026-07-15 07:40:00" },
      { role: "approver", signerName: NAMES.manager, signedAt: "2026-07-15 07:55:00" },
    ],
    audit: [
      { action: "created", actorName: NAMES.requester, note: "طلب تصريح تداول مواد كيميائية", createdAt: "2026-07-15 07:30:00" },
      { action: "rejected", actorName: NAMES.manager, note: "رفض — نقص MSDS وعدم جاهزية معدات احتواء الانسكاب", createdAt: "2026-07-15 07:55:00" },
    ],
  },
  // PTW-013 — عمل عام (منتهٍ بلا إغلاق)
  {
    documentNo: "PTW-013",
    type: "cold_work",
    title: "صيانة دورية لرافعة شوكية (تغيير زيت وإصلاح تسريب هيدروليكي)",
    location: "ورشة الصيانة – منطقة الصيانة رقم 1",
    startAt: "2026-08-25 08:00:00",
    endAt: "2026-08-25 16:00:00",
    durationHours: 8,
    riskLevel: "medium",
    status: "expired",
    workDescription: "صيانة دورية لرافعة شوكية تشمل تغيير الزيت وإصلاح تسريب في النظام الهيدروليكي.",
    contractorName: "قسم الصيانة الداخلي",
    supervisorName: NAMES.supervisor,
    workersCount: 2,
    checklistAnswers: { ...CHECK.common, ...CHECK.cold_work },
    approvedBy: NAMES.manager,
    approvedAt: "2026-08-25 07:50:00",
    signatures: [
      { role: "requester", signerName: NAMES.requester, signedAt: "2026-08-25 07:40:00" },
      { role: "issuer", signerName: NAMES.supervisor, signedAt: "2026-08-25 07:45:00" },
      { role: "safety", signerName: NAMES.safety, signedAt: "2026-08-25 07:50:00" },
      { role: "approver", signerName: NAMES.manager, signedAt: "2026-08-25 07:50:00" },
    ],
    audit: [
      { action: "created", actorName: NAMES.requester, note: "طلب تصريح صيانة دورية لرافعة شوكية", createdAt: "2026-08-25 07:30:00" },
      { action: "approved", actorName: NAMES.manager, note: "اعتماد الصيانة الدورية", createdAt: "2026-08-25 07:50:00" },
      { action: "expired", actorName: "النظام", note: "انتهت صلاحية التصريح دون إغلاق — يتطلب متابعة", createdAt: "2026-08-25 16:00:00" },
    ],
  },
]

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query("BEGIN")

    // مسح تصاريح المؤسسة الحالية وكل ما يتبعها.
    const existing = await client.query<{ id: number }>(`SELECT id FROM permit WHERE "organizationId" = $1`, [ORG_ID])
    const ids = existing.rows.map((r) => r.id)
    if (ids.length) {
      await client.query(`DELETE FROM permit_signature WHERE "permitId" = ANY($1::int[])`, [ids])
      await client.query(`DELETE FROM permit_audit_log WHERE "permitId" = ANY($1::int[])`, [ids])
    }
    await client.query(`DELETE FROM permit WHERE "organizationId" = $1`, [ORG_ID])
    console.log(`[v0] wiped ${ids.length} existing permits for org`)

    for (const s of SEEDS) {
      const ins = await client.query<{ id: number }>(
        `INSERT INTO permit (
          "userId","organizationId","documentNo",title,type,location,"requestedBy",status,
          "validFrom","validTo","workDescription","contractorName","workersCount","supervisorName",
          "startAt","endAt","durationHours","riskLevel","checklistAnswers","gasTestReadings",
          "isolationLOTO","closedAt","closedBy","siteConditionAfter","areaEvacuated","archivedAt",
          "approvedBy","approvedAt","rejectionReason","createdAt"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14,
          $15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,
          $27,$28,$29,$30
        ) RETURNING id`,
        [
          OWNER_USER_ID,
          ORG_ID,
          s.documentNo,
          s.title,
          s.type,
          s.location,
          NAMES.requester,
          s.status,
          s.startAt.slice(0, 10),
          s.endAt.slice(0, 10),
          s.workDescription,
          s.contractorName,
          s.workersCount,
          s.supervisorName,
          s.startAt,
          s.endAt,
          s.durationHours,
          s.riskLevel,
          JSON.stringify(s.checklistAnswers),
          JSON.stringify(s.gasTestReadings ?? {}),
          JSON.stringify(s.isolationLOTO ?? {}),
          s.closedAt ?? null,
          s.closedBy ?? "",
          s.siteConditionAfter ?? "",
          s.areaEvacuated ?? false,
          s.archivedAt ?? null,
          s.approvedBy ?? "",
          s.approvedAt ?? null,
          s.rejectionReason ?? "",
          s.audit[0]?.createdAt ?? s.startAt,
        ],
      )
      const permitId = ins.rows[0].id

      for (const sg of s.signatures) {
        await client.query(
          `INSERT INTO permit_signature ("permitId","organizationId",role,"signerName","signatureUrl","signedAt")
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [permitId, ORG_ID, sg.role, sg.signerName, sig(sg.signerName), sg.signedAt],
        )
      }

      for (const a of s.audit) {
        await client.query(
          `INSERT INTO permit_audit_log ("permitId","organizationId",action,"actorId","actorName",note,"createdAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [permitId, ORG_ID, a.action, OWNER_USER_ID, a.actorName, a.note, a.createdAt],
        )
      }

      console.log(`[v0] seeded ${s.documentNo} (${s.status}) id=${permitId} sigs=${s.signatures.length} audit=${s.audit.length}`)
    }

    await client.query("COMMIT")
    console.log(`[v0] done — seeded ${SEEDS.length} workshop permits`)
  } catch (e) {
    await client.query("ROLLBACK")
    console.error("[v0] seed failed, rolled back:", e)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
