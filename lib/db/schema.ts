import { pgTable, text, timestamp, boolean, serial, integer, date, uniqueIndex, index } from "drizzle-orm/pg-core"

// ---------- المؤسسة (المستأجر) — الحدّ الأعلى للعزل في نظام SaaS متعدد المؤسسات ----------
// كل مستخدم وكل سجل تشغيلي ينتمي إلى مؤسسة واحدة عبر organizationId. العزل بين
// المؤسسات صارم: لا يُرى أي صف إلا ضمن مؤسسة صاحب الجلسة.
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  // حالة مراجعة المؤسسة على مستوى المنصّة: pending (بانتظار موافقة مسؤول المنصّة) |
  // approved (مُعتمدة ويمكن لمستخدميها استخدام النظام) | rejected (مرفوضة، الوصول محجوب).
  status: text("status").notNull().default("pending"),
  // قفل "الإعداد الأولي": بعد أول حفظ ناجح لمعلومات المنشأة أو إعدادات التشغيل من مدير
  // المؤسسة يتحوّل إلى true، فتصبح هذه الحقول للعرض فقط لمديري المؤسسة. مسؤول المنصّة
  // وحده يتجاوز القفل (يعدّل دائماً عبر وضع الدخول إلى المؤسسة).
  settingsLocked: boolean("settingsLocked").notNull().default(false),
  // هل طلب مدير المؤسسة فتح التعديل بعد القفل — يظهر لمسؤول المنصّة في قائمة المؤسسات.
  settingsUnlockRequested: boolean("settingsUnlockRequested").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// ---------- Better Auth tables (do not rename columns) ----------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("pending"),
  department: text("department").notNull().default(""),
  // معرّف المؤسسة التي ينتمي إليها المستخدم. يبقى nullable لأن الإنشاء يتم على
  // مرحلتين: Better Auth ينشئ صف المستخدم أولاً، ثم registerOrganization يعيّن
  // المؤسسة مباشرةً بعده. المستخدمون المُرحَّلون لديهم قيمة فعلية دائماً.
  organizationId: text("organizationId"),
  // JSON array of module values the user can access, e.g. ["dashboard","violations"]
  permissions: text("permissions").notNull().default("[]"),
  // تفضيل لغة الواجهة لكل مستخدم ("ar" | "en") — يبقى ثابتًا عبر كل الجلسات.
  locale: text("locale").notNull().default("ar"),
  // برنامج البريد المفضّل لإرسال التقارير: "microsoft" | "google" | "device" | "copy" | null.
  // null = اسأل في كل مرة. يُحفظ عند تفعيل "اجعله خياري الافتراضي" في نافذة الاختيار.
  preferredEmailProvider: text("preferred_email_provider"),
  // حالة الحساب بعد اعتماده: active | suspended | banned — منفصلة تماماً عن status
  // (pending/approved/rejected = مرحلة تسجيل الحساب). suspended/banned يُمنعان من الدخول
  // على مستوى الخادم (hook تسجيل الدخول + حارس الجلسة).
  accountStatus: text("account_status").notNull().default("active"),
  // آخر دخول ناجح — يُسجَّل فعلياً عند كل sign-in (لا يُشتق من الجلسات).
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: text("last_login_ip").default(""),
  lastLoginDevice: text("last_login_device").default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// سجل تدقيق تغييرات المستخدمين (إدراج فقط): من غيّر، على من، أي حقل، القيمة قبل/بعد.
// action: role_change | account_status_change | password_reset | permissions_change | ...
export const userAuditLog = pgTable(
  "user_audit_log",
  {
    id: serial("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    actorName: text("actor_name").notNull().default(""),
    actorEmail: text("actor_email").notNull().default(""),
    targetUserId: text("target_user_id").notNull(),
    targetEmail: text("target_email").notNull().default(""),
    action: text("action").notNull(),
    field: text("field").notNull().default(""),
    oldValue: text("old_value").default(""),
    newValue: text("new_value").default(""),
    note: text("note").default(""),
    ip: text("ip").default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("user_audit_log_target_idx").on(t.targetUserId), index("user_audit_log_created_idx").on(t.createdAt)],
)

// ---------- حسابات البريد المرتبطة (OAuth) للإرسال المباشر من بريد المستخدم ----------
// صف واحد لكل (مستخدم، مزوّد). الرموز مُشفَّرة بـ AES-256-GCM بمفتاح ENCRYPTION_KEY
// قبل التخزين؛ لا تُعاد أبداً إلى العميل. provider: "microsoft" | "google".
export const emailAccount = pgTable(
  "email_account",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    // عنوان البريد المرتبط (للعرض في الإعدادات والنافذة).
    emailAddress: text("emailAddress").notNull().default(""),
    accessTokenEnc: text("accessTokenEnc").notNull(),
    refreshTokenEnc: text("refreshTokenEnc"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    scope: text("scope"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("email_account_user_provider_idx").on(t.userId, t.provider)],
)

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// ---------- HSE app tables (scoped by userId, no FK) ----------
export const company = pgTable("company", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  name: text("name").notNull().default(""),
  industry: text("industry").default(""),
  address: text("address").default(""),
  phone: text("phone").default(""),
  email: text("email").default(""),
  employeeCount: integer("employeeCount").default(0),
  hseManager: text("hseManager").default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// ---------- دورة الحياة الموحّدة للمخالفة والحادث ----------
// source: "ai_detection" | "manual" (ثابت بعد الإنشاء).
// lifecycleStatus: "new" | "referred" | "in_progress" | "closed" | "archived".
// assignedDept: "hr" | "finance" (قابل للتوسع). الحقول القديمة (hrStatus/financeStatus/
// category...) تبقى وتُحدَّث تزامنياً للتوافق مع الشاشات القائمة.
const lifecycleColumns = {
  source: text("source").notNull().default("manual"),
  lifecycleStatus: text("lifecycle_status").notNull().default("new"),
  assignedDept: text("assigned_dept"),
  referralNotes: text("referral_notes").default(""),
  dueDate: date("due_date"),
  referredBy: text("referred_by").default(""),
  referredAt: timestamp("referred_at"),
  closureAction: text("closure_action").default(""),
  closureEvidenceUrl: text("closure_evidence_url").default(""),
  lifecycleClosedAt: timestamp("lifecycle_closed_at"),
  lifecycleClosedBy: text("lifecycle_closed_by").default(""),
  archivedAt: timestamp("archived_at"),
  reopenReason: text("reopen_reason").default(""),
  reopenedBy: text("reopened_by").default(""),
  reopenedAt: timestamp("reopened_at"),
}

export const incident = pgTable("incident", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  documentNo: text("documentNo").default(""),
  title: text("title").notNull(),
  location: text("location").default(""),
  type: text("type").default("near_miss"),
  severity: text("severity").default("low"),
  status: text("status").default("open"),
  reportedBy: text("reportedBy").default(""),
  description: text("description").default(""),
  incidentDate: date("incidentDate"),
  incidentTime: text("incidentTime").default(""),
  directCauses: text("direct_causes").default(""),
  rootCauses: text("root_causes").default(""),
  propertyDamage: text("property_damage").default(""),
  damageCost: text("damage_cost").default(""),
  immediateActions: text("immediate_actions").default(""),
  parties: text("parties").default("[]"),
  witnesses: text("witnesses").default(""),
  authoritiesNotified: text("authorities_notified").default("no"),
  authorityName: text("authority_name").default(""),
  recommendations: text("recommendations").default(""),
  reporterSignature: text("reporter_signature").default(""),
  safetySignature: text("safety_signature").default(""),
  hrSignature: text("hr_signature").default(""),
  gmSignature: text("gm_signature").default(""),
  managerSignature: text("manager_signature").default(""),
  // جهة التحويل التشغيلية: hr | finance. تبقى null للحوادث القديمة غير الموجّهة.
  routedTo: text("routed_to"),
  // تصنيف الحادثة: internal (طرف متضرر موظف → الموارد البشرية) | external (طرف خارجي → المالية).
  // يحدّد جهة الإحالة المسموحة حصراً — لا يُسمح بإحالة الخارجي إلى HR.
  classification: text("classification").notNull().default("internal"),
  hrAction: text("hr_action").default(""),
  hrActionDate: date("hr_action_date"),
  hrNotes: text("hr_notes").default(""),
  // مسار الإحالة للموارد البشرية: pending | in_review | closed (null يُعامل كـ pending).
  hrStatus: text("hr_status"),
  hrClosedBy: text("hr_closed_by").default(""),
  hrClosedAt: timestamp("hr_closed_at"),
  // مرفقات قرار الموارد البشرية (JSON array من data URLs، بنفس آلية الصور/التواقيع).
  hrAttachmentUrl: text("hr_attachment_url").default(""),
  // مسار الإغلاق المالي للحوادث المحوّلة إلى المالية.
  financeStatus: text("finance_status"),
  settlementNumber: text("settlement_number").default(""),
  paymentReceiptUrl: text("payment_receipt_url").default(""),
  financeClosedBy: text("finance_closed_by").default(""),
  financeClosedAt: timestamp("finance_closed_at"),
  ...lifecycleColumns,
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const inspection = pgTable("inspection", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  title: text("title").notNull(),
  area: text("area").default(""),
  inspector: text("inspector").default(""),
  status: text("status").default("scheduled"),
  compliance: integer("compliance").default(0),
  findings: integer("findings").default(0),
  inspectionDate: date("inspectionDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const permit = pgTable("permit", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  documentNo: text("documentNo").default(""),
  title: text("title").notNull(),
  type: text("type").default("construction"),
  location: text("location").default(""),
  requestedBy: text("requestedBy").default(""),
  status: text("status").default("pending"),
  validFrom: date("validFrom"),
  validTo: date("validTo"),
  // حقول ديناميكية خاصة بكل نوع تصريح، مخزّنة كـ JSON.
  details: text("details").default(""),
  // بيانات اعتماد/رفض المدير.
  approvedBy: text("approvedBy").default(""),
  approvedAt: timestamp("approvedAt"),
  rejectionReason: text("rejectionReason").default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const risk = pgTable("risk", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  hazard: text("hazard").notNull(),
  activity: text("activity").default(""),
  likelihood: integer("likelihood").default(1),
  consequence: integer("consequence").default(1),
  controls: text("controls").default(""),
  proposedControls: text("proposedControls").default(""),
  owner: text("owner").default(""),
  status: text("status").default("open"),
  reviewDate: text("reviewDate").default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const training = pgTable("training", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  title: text("title").notNull(),
  trainer: text("trainer").default(""),
  attendees: integer("attendees").default(0),
  status: text("status").default("scheduled"),
  trainingDate: date("trainingDate"),
  conductedBy: text("conducted_by").default(""),
  language: text("language").default(""),
  trainerSignature: text("trainer_signature").default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// سجل الموظفين المرجعي المستخدم في جلسات التدريب وToolbox Talk.
export const employee = pgTable("employees", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  employeeId: text("employee_id").notNull(),
  name: text("name").notNull(),
  designation: text("designation").notNull().default(""),
  department: text("department").notNull().default(""),
  company: text("company").notNull().default("MHS"),
  nationality: text("nationality").notNull().default(""),
  profileStatus: text("profile_status").notNull().default("complete"),
  cardCode: text("card_code").default(""),
  // الرقم التعريفي المطرّز على ظهر زيّ الموظف (تحت شعار MHS) — مرجع هوية الموظف عند
  // رصد المخالفات. يُدخله المفتش يدوياً في المخالفة فيربطها النظام تلقائياً بملف الموظف.
  uniformNumber: text("uniform_number").notNull().default(""),
  // رقم هاتف الموظف — يظهر تلقائياً في نموذج المخالفة عند التعرّف على هويته.
  phone: text("phone").notNull().default(""),
  // الصورة الشخصية للموظف (data URL أو رابط Blob) — تظهر تلقائياً عند التعرّف.
  photoUrl: text("photo_url").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const toolboxSession = pgTable("toolbox_session", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  sourceKey: text("source_key").notNull(),
  documentNo: text("document_no").notNull(),
  date: text("date").notNull().default(""),
  time: text("time").notNull().default(""),
  location: text("location").notNull().default(""),
  topic: text("topic").notNull().default(""),
  speaker: text("speaker").notNull().default(""),
  summary: text("summary").notNull().default(""),
  photos: text("photos").notNull().default("[]"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const toolboxAttendee = pgTable("toolbox_attendee", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  sessionId: integer("session_id").notNull(),
  employeeRefId: integer("employee_ref_id"),
  employeeId: text("employee_id").notNull().default(""),
  name: text("name").notNull(),
  designation: text("designation").notNull().default(""),
  company: text("company").notNull().default("MHS"),
  cardCode: text("card_code").notNull().default(""),
  signature: text("signature").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// سجل حضور كل متدرب لدورة تدريبية (نموذج MHS-IMS-FR-HSE-2)
export const trainingAttendee = pgTable("training_attendee", {
  id: serial("id").primaryKey(),
  trainingId: integer("training_id").notNull(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  rowNo: integer("row_no").default(0),
  name: text("name").default(""),
  designation: text("designation").default(""),
  company: text("company").default("MHS"),
  cardCode: text("card_code").default(""),
  understood: text("understood").default("yes"),
  signature: text("signature").default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const correctiveAction = pgTable("corrective_action", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  title: text("title").notNull(),
  source: text("source").default(""),
  assignedTo: text("assignedTo").default(""),
  priority: text("priority").default("medium"),
  status: text("status").default("open"),
  dueDate: date("dueDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const audit = pgTable("audit", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  title: text("title").notNull(),
  standard: text("standard").default(""),
  auditor: text("auditor").default(""),
  score: integer("score").default(0),
  status: text("status").default("scheduled"),
  auditDate: date("auditDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const violation = pgTable("violation", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  documentNo: text("documentNo").default("MHS-IMS-PR-HSE-647"),
  companyName: text("companyName").default(""),
  employeeRefId: integer("employee_ref_id"),
  employeeName: text("employeeName").notNull(),
  employeeNo: text("employeeNo").default(""),
  nationality: text("nationality").default(""),
  violationType: text("violationType").default(""),
  category: text("category").default("internal"),
  // مصدر إدخال المخالفة: electronic (عبر النظام) | manual (نموذج ورقي ممسوح).
  entryMode: text("entry_mode").notNull().default("electronic"),
  // اسم المفتش/الموظف الذي رصد المخالفة (يُعبّأ تلقائياً عند الرصد بالذكاء الاصطناعي).
  detectedBy: text("detected_by").default(""),
  internalAction: text("internal_action").default(""),
  violationDate: date("violationDate"),
  violationTime: text("violationTime").default(""),
  place: text("place").default(""),
  description: text("description").default(""),
  witnesses: text("witnesses").default(""),
  evidences: text("evidences").default(""),
  proposedAction: text("proposedAction").default(""),
  status: text("status").default("open"),
  editorSignature: text("editor_signature").default(""),
  violatorSignature: text("violator_signature").default(""),
  managerSignature: text("manager_signature").default(""),
  hrAction: text("hr_action").default(""),
  hrActionDate: date("hr_action_date"),
  hrNotes: text("hr_notes").default(""),
  // مسار الإحالة للموارد البشرية: pending | in_review | closed (null يُعامل كـ pending).
  hrStatus: text("hr_status"),
  hrClosedBy: text("hr_closed_by").default(""),
  hrClosedAt: timestamp("hr_closed_at"),
  // مرفقات قرار الموارد البشرية (JSON array من data URLs، بنفس آلية الصور/التواقيع).
  hrAttachmentUrl: text("hr_attachment_url").default(""),
  // مسار الإحالة إلى المالية للمخالفات الخارجية: pending | in_review | closed (null يُعامل كـ pending).
  financeStatus: text("finance_status"),
  settlementNumber: text("settlement_number").default(""),
  // إيصال الدفع مخزّن كـ data URL واحد (بنفس آلية رفع الملفات في النظام).
  paymentReceiptUrl: text("payment_receipt_url").default(""),
  financeClosedBy: text("finance_closed_by").default(""),
  financeClosedAt: timestamp("finance_closed_at"),
  // ربط المخالفة بدخول مركبة مفتوح في موديول تتبع المركبات (nullable). يُستخدم لحجب
  // خروج المركبة طالما هناك مخالفة مرتبطة بدخولها الحالي.
  entryId: integer("entry_id"),
  ...lifecycleColumns,
  // بيانات الرصد الآلي المنسوخة عند التحويل من المراقبة الذكية (source = ai_detection).
  aiConfidence: integer("ai_confidence"),
  aiSeverity: text("ai_severity").default(""),
  aiCameraId: text("ai_camera_id").default(""),
  sourceDetectionId: integer("source_detection_id"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// سجل حركة السجل (تدقيق، إدراج فقط): كل انتقال في دورة حياة مخالفة/حادث.
// event: created | converted_from_ai | referred | in_progress | closed | archived | reopened.
export const recordEvent = pgTable(
  "record_event",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organizationId").notNull(),
    module: text("module").notNull(), // violations | incidents
    recordId: integer("record_id").notNull(),
    event: text("event").notNull(),
    fromStatus: text("from_status").default(""),
    toStatus: text("to_status").default(""),
    userId: text("user_id").default(""),
    userName: text("user_name").default(""),
    note: text("note").default(""),
    meta: text("meta").default(""), // JSON
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("record_event_module_record_idx").on(t.module, t.recordId)],
)

// إشعار داخلي عام موجّه لجهة (hr | finance) داخل المؤسسة — يُستخدم لإحالات المخالفات/الحوادث.
export const appNotification = pgTable(
  "app_notification",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organizationId").notNull(),
    targetModule: text("target_module").notNull(),
    module: text("module").notNull(),
    recordId: integer("record_id").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull().default(""),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("app_notification_org_target_idx").on(t.organizationId, t.targetModule, t.read)],
)

// ملاحظات وإيجابيات الجولة الميدانية.
// kind: "observation" (ملاحظة/شبه حادثة) أو "positive" (ملاحظة إيجابية).
export const observation = pgTable("observation", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  patrolId: text("patrolId").default(""),
  kind: text("kind").notNull().default("observation"),
  documentNo: text("documentNo").default(""),
  description: text("description").notNull().default(""),
  location: text("location").default(""),
  observedBy: text("observedBy").default(""),
  observationDate: date("observationDate"),
  observationTime: text("observationTime").default(""),
  status: text("status").default("open"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const attachment = pgTable("attachment", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  module: text("module").notNull(),
  recordId: integer("recordId").notNull(),
  kind: text("kind").notNull().default("photo"),
  pathname: text("pathname").notNull(),
  url: text("url").notNull().default(""),
  filename: text("filename").notNull().default(""),
  contentType: text("contentType").notNull().default(""),
  size: integer("size").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// ---------- المراقبة الذكية بالذكاء الاصطناعي (كاميرات ساحات الرافعات) ----------
// detectionType: أحد الأنواع الستة (no_ppe / traffic_congestion / unsafe_stacking /
//   overspeed / restricted_area / pedestrian_near_forklift).
// severity: low / medium / high / critical.
// status: new / acknowledged / resolved / false_positive / converted.
export const aiDetection = pgTable("ai_detections", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  detectionId: text("detection_id").notNull(), // AID-YYYY-###
  cameraId: text("camera_id").notNull().default(""),
  inspectorName: text("inspector_name").notNull().default(""), // اسم المفتش/الموظف صاحب الجلسة
  cameraLocation: text("camera_location").notNull().default(""),
  detectionType: text("detection_type").notNull().default("no_ppe"),
  // كل أنواع المخالفات المرصودة في نفس اللقطة/الإطار كسلسلة JSON (مثال:
  // ["no_ppe","unsafe_stacking"]). detectionType أعلاه يبقى النوع الأساسي (الأشد
  // خطورة) للتوافق مع الشارات والفلاتر والإحصاءات الحالية.
  detectionTypes: text("detection_types").notNull().default(""),
  severity: text("severity").notNull().default("low"),
  confidenceScore: integer("confidence_score").notNull().default(0), // 0-100
  snapshotUrl: text("snapshot_url").notNull().default(""),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  // منع التكرار: عند استمرار نفس المخالفة لنفس الشخص/المركبة في نفس الموقع ضمن نافذة
  // زمنية قصيرة، لا يُنشأ سجل جديد بل يُحدَّث الموجود: يزداد detectionCount ويُحدَّث
  // lastDetectedAt. subjectKey هو هوية الشخص (اليونيفورم) أو المركبة (اللوحة) مطبّعة،
  // وsubjectType يميّز employee/vehicle حتى لا تُخلط الهويات.
  detectionCount: integer("detection_count").notNull().default(1),
  lastDetectedAt: timestamp("last_detected_at").notNull().defaultNow(),
  subjectKey: text("subject_key").notNull().default(""),
  subjectType: text("subject_type").notNull().default(""),
  status: text("status").notNull().default("new"),
  acknowledgedBy: text("acknowledged_by").default(""),
  resolvedBy: text("resolved_by").default(""),
  notes: text("notes").default(""),
  // رقم المخالفة المرتبطة (VIO-YYYY-###) عند تحويل الاكتشاف إلى مخالفة رسمية.
  linkedViolationNo: text("linked_violation_no").default(""),
  // روابط التحويل الرقمية (مصدر الحقيقة لمنع العدّ المزدوج في الرسوم):
  // الكشف المحوَّل يُحسب مرة واحدة في سجلّه الرسمي ولا يُعدّ بنداً مفتوحاً في رسم الكشوفات.
  convertedToIncidentId: integer("converted_to_incident_id"),
  convertedToViolationId: integer("converted_to_violation_id"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// إشعارات المراقبة الذكية — سجل لكل مستلم عن كل اكتشاف عالي الخطورة/حرج.
// (مدموج من فرع ai-smart-monitoring مع مواءمة الأنواع لبنية main:
// userId نصّي مطابق لجدول user، وdetectionId يشير إلى aiDetection.id الرقمي.)
export const aiMonitoringNotification = pgTable("ai_monitoring_notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  organizationId: text("organizationId").notNull(),
  detectionId: integer("detection_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// كاميرات الهاتف المتصلة حالياً — سجل واحد لكل كاميرا (userId + cameraId فريد).
// يُحدّث lastFrameUrl و lastSeenAt مع كل استدعاء لمسار /api/ai-monitoring/analyze،
// ما يتيح للوحة المدير عرض بث "شبه حي" لكل كاميرا نشطة.
export const activeCameraStream = pgTable(
  "active_camera_streams",
  {
    id: serial("id").primaryKey(),
    userId: text("userId").notNull(),
    organizationId: text("organizationId").notNull(),
    cameraId: text("camera_id").notNull(),
    inspectorName: text("inspector_name").notNull().default(""), // اسم المفتش/الموظف الذي بدأ الجلسة
    cameraLocation: text("camera_location").notNull().default(""),
    lastFrameUrl: text("last_frame_url").notNull().default(""),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    userCameraUnique: uniqueIndex("active_cam_user_camera_idx").on(t.userId, t.cameraId),
  }),
)

// قناة إشارات WebRTC (signaling) عبر قاعدة البيانات — بديل خفيف عن WebSocket يناسب
// بيئة الخوادم بلا حالة. تُخزَّن هنا عروض/إجابات SDP ومرشحات ICE مؤقتاً بين
// الكاميرا (المُرسِل) والمدير (المشاهد)، ويُستقصى منها كل ~ثانية أثناء إنشاء الاتصال فقط.
// بعد نجاح الاتصال ينتقل الفيديو مباشرةً بين الطرفين (P2P) دون المرور بالخادم.
export const webrtcSignal = pgTable(
  "webrtc_signals",
  {
    id: serial("id").primaryKey(),
    cameraId: text("camera_id").notNull(), // جلسة الكاميرا الهدف
    viewerSessionId: text("viewer_session_id").notNull(), // جلسة تفويض المشاهد (تسمح بإعادة الاتصال)
    sender: text("sender").notNull(), // "camera" | "viewer"
    kind: text("kind").notNull(), // "offer" | "answer" | "ice"
    payload: text("payload").notNull(), // SDP أو مرشّح ICE مُرمَّز JSON
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    lookupIdx: index("webrtc_lookup_idx").on(t.cameraId, t.viewerSessionId, t.id),
  }),
)

// تسجيلات الفيديو المرفوعة من كاميرا الهاتف إلى Vercel Blob.
// userId = مالك التسجيل (الحساب الذي سجّل)، ونطاق العرض مقصور عليه.
export const videoRecording = pgTable("video_recordings", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  cameraId: text("camera_id").notNull().default(""),
  cameraName: text("camera_name").notNull().default(""),
  videoUrl: text("video_url").notNull(),
  posterUrl: text("poster_url").notNull().default(""),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  fileSizeBytes: integer("file_size_bytes").notNull().default(0),
  recordedBy: text("recorded_by").notNull().default(""),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// اللقطات المستخرجة من تسجيل فيديو عبر مشغّل المراجعة.
export const videoScreenshot = pgTable("video_screenshots", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  recordingId: integer("recording_id").notNull(),
  cameraId: text("camera_id").notNull().default(""),
  imageUrl: text("image_url").notNull(),
  atSeconds: integer("at_seconds").notNull().default(0),
  linkedViolationId: integer("linked_violation_id"),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const document = pgTable("document", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  title: text("title").notNull(),
  category: text("category").default(""),
  version: text("version").default("1.0"),
  owner: text("owner").default(""),
  status: text("status").default("active"),
  reviewDate: date("reviewDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// ========== وحدات مطابقة ISO 45001:2018 (المرحلة الثانية) ==========

// البند 4 — سياق المنظمة: القضايا الداخلية/الخارجية والأطراف المعنية واحتياجاتها.
// kind: internal (قضية داخلية) | external (قضية خارجية) | interested_party (طرف معني).
export const orgContextIssue = pgTable("org_context_issue", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  kind: text("kind").notNull().default("internal"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  // احتياجات/توقعات الطرف المعني (يُستخدم أساساً مع interested_party).
  needs: text("needs").notNull().default(""),
  // التأثير على نظام السلامة: low | medium | high.
  impact: text("impact").notNull().default("medium"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// البند 5.2 — سياسة السلامة والصحة المهنية: بيانات السياسة المعتمدة وإصداراتها.
// status: draft (مسودة) | active (سارية) | archived (مؤرشفة).
export const ohsPolicy = pgTable("ohs_policy", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  title: text("title").notNull().default(""),
  version: text("version").notNull().default("1.0"),
  statement: text("statement").notNull().default(""),
  approvedBy: text("approved_by").notNull().default(""),
  approvedDate: date("approved_date"),
  reviewDate: date("review_date"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// البند 6.2 — أهداف السلامة والصحة المهنية وخطط تحقيقها.
// status: not_started (لم يبدأ) | on_track (على المسار) | at_risk (متعثّر) | achieved (متحقّق).
export const ohsObjective = pgTable("ohs_objective", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  title: text("title").notNull(),
  indicator: text("indicator").notNull().default(""),
  baseline: text("baseline").notNull().default(""),
  target: text("target").notNull().default(""),
  responsible: text("responsible").notNull().default(""),
  progress: integer("progress").notNull().default(0), // 0-100
  status: text("status").notNull().default("not_started"),
  dueDate: date("due_date"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// البند 6.1.3 — سجل المتطلبات القانونية والمتطلبات الأخرى وتقييم الالتزام بها.
// complianceStatus: compliant | partial | non_compliant.
export const legalRequirement = pgTable("legal_requirement", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  title: text("title").notNull(),
  reference: text("reference").notNull().default(""),
  authority: text("authority").notNull().default(""),
  category: text("category").notNull().default(""),
  applicability: text("applicability").notNull().default(""),
  complianceStatus: text("compliance_status").notNull().default("compliant"),
  lastReviewDate: date("last_review_date"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// ========== وحدات مطابقة ISO 45001:2018 التشغيلية (المرحلة الثالثة) ==========

// البند 5.4 — تشاور العمال ومشاركتهم: سجل أنشطة التشاور والمشاركة.
// activityType: consultation (تشاور) | participation (مشاركة).
// method: meeting (اجتماع) | survey (استبيان) | committee (لجنة سلامة) | suggestion (صندوق مقترحات).
export const workerConsultation = pgTable("worker_consultation", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  topic: text("topic").notNull(),
  activityType: text("activity_type").notNull().default("consultation"),
  method: text("method").notNull().default("meeting"),
  participants: integer("participants").notNull().default(0),
  outcome: text("outcome").notNull().default(""),
  activityDate: date("activity_date"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// البند 8.2 — التأهب للطوارئ والاستجابة لها: خطط الطوارئ وتماريــنها.
// planType: fire (حريق) | chemical (كيميائي) | medical (طبي) | evacuation (إخلاء) | natural (طبيعي).
// status: ready (جاهزة) | needs_review (تحتاج مراجعة) | outdated (منتهية).
export const emergencyPlan = pgTable("emergency_plan", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  scenario: text("scenario").notNull(),
  planType: text("plan_type").notNull().default("fire"),
  responsibleTeam: text("responsible_team").notNull().default(""),
  lastDrillDate: date("last_drill_date"),
  nextDrillDate: date("next_drill_date"),
  status: text("status").notNull().default("ready"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// البند 8.1.4 — المقاولون والمشتريات: تأهيل وتقييم مقاولي السلامة والصحة المهنية.
// status: approved (معتمد) | conditional (مشروط) | rejected (مرفوض).
export const contractor = pgTable("contractor", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  name: text("name").notNull(),
  scope: text("scope").notNull().default(""),
  hseRating: integer("hse_rating").notNull().default(0), // 0-100
  evaluationDate: date("evaluation_date"),
  status: text("status").notNull().default("approved"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// البند 9.3 — مراجعة الإدارة: محاضر اجتماعات مراجعة الإدارة ومخرجاتها.
export const managementReview = pgTable("management_review", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  title: text("title").notNull(),
  reviewDate: date("review_date"),
  attendees: text("attendees").notNull().default(""),
  inputs: text("inputs").notNull().default(""),
  decisions: text("decisions").notNull().default(""),
  nextReviewDate: date("next_review_date"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// البند 9.2 — التدقيق الداخلي: برنامج التدقيق الداخلي ونتائجه.
// status: planned (مخطّط) | in_progress (جارٍ) | completed (مكتمل).
export const internalAudit = pgTable("internal_audit", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  title: text("title").notNull(),
  scope: text("scope").notNull().default(""),
  auditor: text("auditor").notNull().default(""),
  auditDate: date("audit_date"),
  nonconformities: integer("nonconformities").notNull().default(0),
  status: text("status").notNull().default("planned"),
  result: text("result").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// ذاكرة ترجمة البيانات المُدخلة (أوصاف/ملاحظات) عبر الذكاء الاصطناعي.
// نُخزّن الترجمة مرة واحدة لكل (نص مصدر + لغة هدف) لتجنّب تكرار الاستدعاءات
// وتث��يت النتيجة. sourceHash = بصمة النص المصدر لتسريع البحث وتفادي مفاتيح ضخمة.
export const translationCache = pgTable(
  "translation_cache",
  {
    id: serial("id").primaryKey(),
    sourceHash: text("source_hash").notNull(),
    sourceText: text("source_text").notNull(),
    targetLocale: text("target_locale").notNull(), // "ar" | "en"
    translatedText: text("translated_text").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    lookupIdx: uniqueIndex("translation_cache_lookup_idx").on(t.sourceHash, t.targetLocale),
  }),
)

// ---------- التعرّف متعدد الأوضاع من كاميرا الهاتف (لوحات/رقم وظيفي/توك توك) ----------
// كل جدول يخزّن قراءة واحدة مستخرجة بالذكاء الاصطناعي من إطار كاميرا، مع نطاق
// الرؤية مقصوراً على userId (نفس نمط باقي جداول التطبيق).

// قراءات لوحات المركبات (الوضع 2).
export const plateRead = pgTable("plate_reads", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  plateNumber: text("plate_number").notNull().default(""),
  confidence: integer("confidence").notNull().default(0), // 0-100
  imageUrl: text("image_url").notNull().default(""),
  cameraName: text("camera_name").notNull().default(""),
  location: text("location").notNull().default(""),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
})

// قراءات الرقم الوظيفي من زيّ العامل (الوضع 3).
export const employeeIdRead = pgTable("employee_id_reads", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  employeeNumber: text("employee_number").notNull().default(""),
  // معرّف الموظف المطابق في جدول employees (رقمي)، أو null إن لم يُطابق.
  matchedEmployeeId: integer("matched_employee_id"),
  confidence: integer("confidence").notNull().default(0), // 0-100
  imageUrl: text("image_url").notNull().default(""),
  cameraName: text("camera_name").notNull().default(""),
  location: text("location").notNull().default(""),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
})

// ---------- سجل المعدات المرجعي (رافعات شوكية / توك توك / مركبات / رافعات) ----------
// المرجع الذي تُطابَق ضده لوحات المركبات المقروءة تلقائياً من الكاميرا. المُعرّف
// الأساسي هو لوحة المركبة الرسمية (plateNumber). عند قراءة لوحة ومطابقتها هنا،
// يعرض النظام تلقائياً نوع المعدة والشركة المسؤولة واسم السائق المخوّل في المخالفة.
export const equipment = pgTable(
  "equipment",
  {
    id: serial("id").primaryKey(),
    userId: text("userId").notNull(),
    organizationId: text("organizationId").notNull(),
    // لوحة المركبة الرسمية — المُعرّف المستخدم للمطابقة مع القراءة البصرية.
    plateNumber: text("plate_number").notNull().default(""),
    // نوع المعدة: forklift | tuktuk | truck | crane | other.
    equipmentType: text("equipment_type").notNull().default("forklift"),
    // الشركة المالكة أو الجهة المسؤولة عن المعدة.
    ownerCompany: text("owner_company").notNull().default(""),
    // اسم السائق/المستخدم المخوّل بتشغيل المعدة.
    driverName: text("driver_name").notNull().default(""),
    // رقم داخلي/ك��د أصل اختياري (غير مستخدم في المطابقة، للعرض فقط).
    internalCode: text("internal_code").notNull().default(""),
    active: boolean("active").notNull().default(true),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    plateIdx: index("equipment_plate_idx").on(t.organizationId, t.plateNumber),
  }),
)

// ---------- قواعد السلامة حسب الموقع ----------
// مجموعة قواعد سلامة قابلة للتحرير لكل موقع/منطقة كاميرا. تُمرَّر إلى نموذج الرؤية
// الحاسوبية لتحكيم السلوك الظاهر في الإطار بدقة (لأن بعض القوانين تختلف حسب المنطقة).
export const safetyRule = pgTable(
  "safety_rules",
  {
    id: serial("id").primaryKey(),
    userId: text("userId").notNull(),
    organizationId: text("organizationId").notNull(),
    // اسم الموقع/المنطقة كما يظهر في cameraLocation عند بدء جلسة الكاميرا.
    location: text("location").notNull().default(""),
    // نص القواعد (سطر لكل قاعدة) الخاص بهذا الموقع.
    rules: text("rules").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    locationIdx: index("safety_rules_location_idx").on(t.organizationId, t.location),
  }),
)

// قراءات رقم التوك توك (الوضع 4).
// permitStatus: valid | expired | not_found — حالة مطابقة تصريح القيادة.
export const tuktukRead = pgTable("tuktuk_reads", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  organizationId: text("organizationId").notNull(),
  tuktukNumber: text("tuktuk_number").notNull().default(""),
  // معرّف تصريح التوك توك المطابق في جدول permit (رقمي)، أو null.
  matchedPermitId: integer("matched_permit_id"),
  permitStatus: text("permit_status").notNull().default("not_found"),
  confidence: integer("confidence").notNull().default(0), // 0-100
  imageUrl: text("image_url").notNull().default(""),
  cameraName: text("camera_name").notNull().default(""),
  location: text("location").notNull().default(""),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
})

// ---------- موديول تتبع المركبات (Vehicle Tracking) ----------
// سجل رئيسي واحد لكل مركبة داخل المؤسسة. المُعرّف التشغيلي هو اللوحة (plateNumber)،
// وplateKey هو اللوحة مطبّعة (حروف+أرقام موحّدة) للمطابقة الموثوقة مع القراءة البصرية.
// currentStatus يعكس الحالة اللحظية: outside (خارج السوق) | inside (داخله) | blocked
// (محجوبة عن الخروج بسبب مخالفة مرتبطة بدخولها الحالي).
export const vehicle = pgTable(
  "vehicles",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organizationId").notNull(),
    plateNumber: text("plate_number").notNull().default(""),
    plateKey: text("plate_key").notNull().default(""),
    vehicleType: text("vehicle_type").notNull().default("truck"),
    currentStatus: text("current_status").notNull().default("outside"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    plateKeyIdx: uniqueIndex("vehicles_org_platekey_idx").on(t.organizationId, t.plateKey),
  }),
)

// سجل دخولات المركبة — عدة سجلات لكل مركبة. status: open (لا تزال داخل السوق) |
// closed (خرجت). id هو المرجع (entryId) الذي تُربط به المشاهدات والمخالفات لهذه الزيارة.
export const vehicleEntry = pgTable(
  "vehicle_entries",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organizationId").notNull(),
    vehicleId: integer("vehicle_id").notNull(),
    entryGateId: integer("entry_gate_id").notNull().default(1),
    entryTime: timestamp("entry_time").notNull().defaultNow(),
    exitTime: timestamp("exit_time"),
    exitGateId: integer("exit_gate_id"),
    status: text("status").notNull().default("open"),
    // مصدر التسجيل: auto (قراءة كاميرا تلقائية) أو manual (إدخال موظف يدوي).
    entryMethod: text("entry_method").notNull().default("manual"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    vehicleIdx: index("vehicle_entries_vehicle_idx").on(t.organizationId, t.vehicleId),
    openIdx: index("vehicle_entries_open_idx").on(t.organizationId, t.vehicleId, t.status),
  }),
)

// إعدادات البوابات لكل مؤسسة. frameSource يحدّد مصدر فريمات الوضع التلقائي لكل بوابة:
// device (كاميرا جهاز المتصفح) أو external (بث خارجي يصل عبر POST /api/camera-feed من
// خادم جسر مرتبط بكاميرات NVR). lastFrameAt/lastPlate تُحدَّث عند وصول فريم خارجي لعرض
// حالة البث حيّاً. لا علاقة لهذا الجدول بمنطق القراءة/التسجيل — هو إعدادات ومصدر فقط.
export const gate = pgTable(
  "gates",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organizationId").notNull(),
    gateNumber: integer("gate_number").notNull(),
    frameSource: text("frame_source").notNull().default("device"),
    lastFrameAt: timestamp("last_frame_at"),
    lastPlate: text("last_plate"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    gateIdx: uniqueIndex("gates_org_number_idx").on(t.organizationId, t.gateNumber),
  }),
)

// كل مرة تُرصد فيها المركبة بأي كاميرا داخل السوق، مرتبطة بالدخول المفتوح الحالي.
export const vehicleSighting = pgTable(
  "vehicle_sightings",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organizationId").notNull(),
    entryId: integer("entry_id").notNull(),
    cameraId: text("camera_id").notNull().default(""),
    locationName: text("location_name").notNull().default(""),
    // مصدر المشاهدة: auto (كاميرا) أو manual (موظف).
    entryMethod: text("entry_method").notNull().default("manual"),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
  },
  (t) => ({
    entryIdx: index("vehicle_sightings_entry_idx").on(t.entryId),
  }),
)

// ---------- إعدادات التشغيل لكل مؤسسة ----------
// قيم كانت مثبّتة في الكود وأصبحت قابلة للتخصيص لكل مؤسسة. العزل عبر organizationId.
// صف واحد لكل مؤسسة يحمل الأعداد العامة (بوابات الدخول/الخروج).
export const orgSettings = pgTable("org_settings", {
  organizationId: text("organizationId").primaryKey(),
  entryGateCount: integer("entry_gate_count").notNull().default(1),
  exitGateCount: integer("exit_gate_count").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// أنواع المركبات المتاحة للمؤسسة (نص عربي حر). sortOrder يحفظ ترتيب العرض.
export const vehicleType = pgTable(
  "vehicle_types",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organizationId").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("vehicle_types_org_idx").on(t.organizationId),
  }),
)

// أنواع المخالفات المتاحة للمؤسسة (نص عربي حر + شدة افتراضية اختيارية).
export const violationType = pgTable(
  "violation_types",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organizationId").notNull(),
    label: text("label").notNull(),
    severity: text("severity").notNull().default("medium"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("violation_types_org_idx").on(t.organizationId),
  }),
)

// فئات الجولة التفتيشية للمؤسسة (نص عربي حر + أيقونة + لون من مجموعة جاهزة).
export const inspectionCategory = pgTable(
  "inspection_categories",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organizationId").notNull(),
    label: text("label").notNull(),
    icon: text("icon").notNull().default("clipboard-check"),
    color: text("color").notNull().default("blue"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("inspection_categories_org_idx").on(t.organizationId),
  }),
)
