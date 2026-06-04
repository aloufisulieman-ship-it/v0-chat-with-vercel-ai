// Per-section access control shared between server and client.

export type SectionKey =
  | "incidents"
  | "inspections"
  | "risks"
  | "permits"
  | "training"
  | "ppe"
  | "violations"
  | "actions"
  | "audits"
  | "documents"
  | "reports"

export type SectionAccess = { view: boolean; edit: boolean }
export type PermissionMap = Record<SectionKey, SectionAccess>

export const SECTIONS: { key: SectionKey; label: string; href: string }[] = [
  { key: "incidents", label: "الحوادث", href: "/incidents" },
  { key: "inspections", label: "التفتيش", href: "/inspections" },
  { key: "risks", label: "تقييم المخاطر", href: "/risks" },
  { key: "permits", label: "تصاريح العمل", href: "/permits" },
  { key: "training", label: "التدريب", href: "/training" },
  { key: "ppe", label: "معدات الوقاية", href: "/ppe" },
  { key: "violations", label: "المخالفات", href: "/violations" },
  { key: "actions", label: "الإجراءات التصحيحية", href: "/actions" },
  { key: "audits", label: "التدقيق", href: "/audits" },
  { key: "documents", label: "الوثائق", href: "/documents" },
  { key: "reports", label: "التقارير", href: "/reports" },
]

export const SECTION_KEYS = SECTIONS.map((s) => s.key)

// A fully-allowed map (used for admins).
export function allAccess(): PermissionMap {
  return Object.fromEntries(SECTION_KEYS.map((k) => [k, { view: true, edit: true }])) as PermissionMap
}

// Default for new/unconfigured users: can view everything, edit nothing.
export function defaultAccess(): PermissionMap {
  return Object.fromEntries(SECTION_KEYS.map((k) => [k, { view: true, edit: false }])) as PermissionMap
}

// Empty map: no access at all.
export function noAccess(): PermissionMap {
  return Object.fromEntries(SECTION_KEYS.map((k) => [k, { view: false, edit: false }])) as PermissionMap
}

// Parse the stored JSON string into a complete PermissionMap.
// Unknown/empty values fall back to defaultAccess() so existing users keep working.
export function parsePermissions(raw: string | null | undefined): PermissionMap {
  if (!raw) return defaultAccess()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return defaultAccess()
  }
  if (!parsed || typeof parsed !== "object") return defaultAccess()
  const obj = parsed as Record<string, Partial<SectionAccess>>
  const result = noAccess()
  for (const key of SECTION_KEYS) {
    const entry = obj[key]
    if (entry && typeof entry === "object") {
      result[key] = { view: !!entry.view, edit: !!entry.edit }
    }
  }
  return result
}

export function serializePermissions(map: PermissionMap): string {
  return JSON.stringify(map)
}

// Resolve effective permissions given a role. Admins always get full access.
export function effectivePermissions(role: string | undefined, raw: string | null | undefined): PermissionMap {
  if (role === "admin") return allAccess()
  return parsePermissions(raw)
}

export function canView(role: string | undefined, raw: string | null | undefined, section: SectionKey): boolean {
  if (role === "admin") return true
  return parsePermissions(raw)[section].view
}

export function canEdit(role: string | undefined, raw: string | null | undefined, section: SectionKey): boolean {
  if (role === "admin") return true
  const access = parsePermissions(raw)[section]
  // Editing implies the section must also be viewable.
  return access.view && access.edit
}
