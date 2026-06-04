// Module-based access control shared between server and client.
import { moduleOptions, type ModuleKey } from "@/lib/labels"

export type { ModuleKey }
export { moduleOptions }

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

// Admins always have full access. Everyone else must have the module in their list.
export function hasModuleAccess(
  role: string | null | undefined,
  permissionsRaw: string | null | undefined,
  module: ModuleKey,
): boolean {
  if (role === "admin") return true
  return parsePermissions(permissionsRaw).includes(module)
}
