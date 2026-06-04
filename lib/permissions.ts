// Module-based access control shared between server and client.
import { moduleOptions, type ModuleKey } from "@/lib/labels"

export type { ModuleKey }
export { moduleOptions }

// Parse the stored permissions string (a JSON array of module values) into an array.
export function parsePermissions(raw: string | null | undefined): ModuleKey[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const valid = new Set(moduleOptions.map((m) => m.value as string))
      return parsed.filter((p): p is ModuleKey => typeof p === "string" && valid.has(p)) as ModuleKey[]
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
