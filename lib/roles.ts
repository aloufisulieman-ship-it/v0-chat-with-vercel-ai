// المصدر الوحيد لتعريف الأدوار وحالات الحساب في النظام (يُستخدم في إدارة المستخدمين
// والتوثيق داخل الواجهة). الصلاحيات الفعلية للوحدات تُحسم في lib/permissions.ts.

export const ASSIGNABLE_ROLES = ["admin", "manager", "user"] as const
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

export const ACCOUNT_STATUSES = ["active", "suspended", "banned"] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

type Loc = "ar" | "en"

export const ROLE_DEFINITIONS: Record<
  AssignableRole | "platform_admin",
  { label: Record<Loc, string>; description: Record<Loc, string>; access: Record<Loc, string> }
> = {
  platform_admin: {
    label: { ar: "مسؤول المنصّة", en: "Platform admin" },
    description: {
      ar: "فوق المؤسسات: يعتمد المؤسسات الجديدة ويدخل إليها للقراءة فقط. لا ينتمي لأي مؤسسة.",
      en: "Above all organizations: approves new organizations and enters them read-only. Belongs to no organization.",
    },
    access: { ar: "لوحة المنصّة + قراءة أي مؤسسة", en: "Platform console + read-only view of any organization" },
  },
  admin: {
    label: { ar: "مدير النظام", en: "Administrator" },
    description: {
      ar: "وصول كامل لكل وحدات مؤسسته، وإدارة المستخدمين (الأدوار، الصلاحيات، الإيقاف، كلمات المرور)، وإعادة فتح السجلات المؤرشفة.",
      en: "Full access to every module in the organization, user management (roles, permissions, suspension, passwords) and reopening archived records.",
    },
    access: { ar: "كل الوحدات (19) + إدارة المستخدمين", en: "All modules (19) + user management" },
  },
  manager: {
    label: { ar: "مشرف", en: "Manager" },
    description: {
      ar: "وصول كامل لكل الوحدات ويرى كل سجلات المؤسسة (لا سجلاته فقط)، لكن بلا إدارة مستخدمين ولا إعادة فتح للمؤرشف.",
      en: "Full module access and sees all organization records, but no user management and cannot reopen archived records.",
    },
    access: { ar: "كل الوحدات — بلا إدارة مستخدمين", en: "All modules — no user management" },
  },
  user: {
    label: { ar: "مستخدم", en: "User" },
    description: {
      ar: "لا يملك أي وحدة تلقائياً؛ يرى فقط الوحدات المُمنوحة له صراحةً في «الصلاحيات»، وداخلها سجلاته فقط (إلا إن كان قسمه «المدير العام» أو «مفتش السلامة»).",
      en: "No modules by default; sees only modules explicitly granted in Permissions, and only their own records within them (unless department is GM or Safety Inspector).",
    },
    access: { ar: "الوحدات المُمنوحة فقط", en: "Granted modules only" },
  },
}

export const ACCOUNT_STATUS_UI: Record<AccountStatus, { label: Record<Loc, string>; description: Record<Loc, string> }> = {
  active: {
    label: { ar: "مفعّل", en: "Active" },
    description: { ar: "يمكنه الدخول والعمل بحسب دوره وصلاحياته.", en: "Can sign in and work per role and permissions." },
  },
  suspended: {
    label: { ar: "موقوف", en: "Suspended" },
    description: {
      ar: "إيقاف مؤقت: يُرفض تسجيل الدخول وتُنهى الجلسات القائمة. يمكن إعادة تفعيله.",
      en: "Temporary: sign-in is refused and active sessions are revoked. Can be reactivated.",
    },
  },
  banned: {
    label: { ar: "محظور", en: "Banned" },
    description: {
      ar: "حظر دائم: كالإيقاف لكن يُقصد به عدم العودة. يمكن للمدير رفعه صراحةً.",
      en: "Permanent: same enforcement as suspension, intended as final. An admin can lift it explicitly.",
    },
  },
}

export const AUDIT_ACTION_LABELS: Record<string, Record<Loc, string>> = {
  role_change: { ar: "تغيير الدور", en: "Role changed" },
  account_status_change: { ar: "تغيير حالة الحساب", en: "Account status changed" },
  password_reset: { ar: "إعادة تعيين كلمة المرور", en: "Password reset" },
  permissions_change: { ar: "تغيير الصلاحيات", en: "Permissions changed" },
  sessions_revoked: { ar: "إنهاء الجلسات", en: "Sessions revoked" },
}
