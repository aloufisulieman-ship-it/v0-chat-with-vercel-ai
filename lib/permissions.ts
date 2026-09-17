// Module-based access control shared between server and client.
import { moduleOptions, type ModuleKey } from "@/lib/labels"

export type { ModuleKey }
export { moduleOptions }

// دور مسؤول المنصّة: فوق المؤسسات، لا ينتمي لأي organizationId، ويرى كل المؤسسات.
// يختلف جوهرياً عن دور "admin" الذي هو مدير داخل مؤسسة واحدة فقط.
export const PLATFORM_ADMIN_ROLE = "platform_admin"

export function isPlatformAdmin(role: string | null | undefined): boolean {
  return role === PLATFORM_ADMIN_ROLE
}

// دور المدقق: صلاحيات مدير السلامة والصحة المهنية لكن بنطاق تدقيق ISO 45001 حصراً.
export const AUDITOR_ROLE = "auditor"

export function isAuditor(role: string | null | undefined): boolean {
  return role === AUDITOR_ROLE
}

// الوحدات التي يملكها المدقق تلقائياً (نطاق تدقيق ISO 45001). ما عداها ممنوع عليه
// مهما كانت صلاحياته المحفوظة — وعلى رأسها "hr" و"finance" و"users" و"settings":
// فبيانات الإجراءات التأديبية والتسويات المالية خارج نطاق التدقيق تماماً.
export const AUDITOR_MODULES: ModuleKey[] = [
  "dashboard",
  "audits",
  "internal-audit",
  "compliance",
  "incidents",
  "violations",
  "risks",
  "inspections",
  "permits",
  "training",
  "employees",
  "equipment",
  "safety_rules",
  "patrol",
  "ai_monitoring",
  "actions",
  "context",
  "policy",
  "objectives",
  "legal-register",
  "consultation",
  "emergency",
  "contractors",
  "management-review",
  "documents",
  "reports",
]

export function auditorCanAccess(module: ModuleKey): boolean {
  return AUDITOR_MODULES.includes(module)
}

// Parse the stored permissions string (a JSON array of module values) into an array.
export function parsePermissions(raw: string | null | undefined): ModuleKey[] {
  if (!raw) return []
  const valid = new Set(moduleOptions.map((m) => m.value as string))
  try {
    const parsed = JSON.parse(raw)
    // Current format: array of module values.
    if (Array.isArray(parsed)) {
      return parsed.filter((p): p is ModuleKey => typeof p === "string" && valid.has(p)) as ModuleKey[]
    }
    // Legacy format: { [section]: { view, edit } } — keep any section the user could view.
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed)
        .filter(([key, val]) => valid.has(key) && (val as { view?: boolean })?.view === true)
        .map(([key]) => key as ModuleKey)
    }
  } catch {
    // ignore malformed values
  }
  return []
}

// Serialize an array of module values to the stored string form.
export function serializePermissions(modules: string[]): string {
  const valid = new Set(moduleOptions.map((m) => m.value as string))
  const unique = Array.from(new Set(modules.filter((m) => valid.has(m))))
  return JSON.stringify(unique)
}

// admin و manager يملكان وصولاً تلقائياً كاملاً لكل الوحدات (حمايةً من قفلهم خارجاً)،
// والمدقق يملك تلقائياً وحدات تدقيق ISO 45001 فقط ولا يتجاوزها ولو مُنحت له صراحةً،
// وأي دور آخر (مثل "user") يجب أن تكون الوحدة ضمن قائمة صلاحياته الصريحة.
export function hasModuleAccess(
  role: string | null | undefined,
  permissionsRaw: string | null | undefined,
  module: ModuleKey,
): boolean {
  if (role === "admin" || role === "manager") return true
  if (isAuditor(role)) return auditorCanAccess(module)
  return parsePermissions(permissionsRaw).includes(module)
}
