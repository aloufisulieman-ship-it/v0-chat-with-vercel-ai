"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { SECTIONS, type PermissionMap, type SectionKey } from "@/lib/permissions"

export function PermissionsEditor({
  value,
  onChange,
}: {
  value: PermissionMap
  onChange: (next: PermissionMap) => void
}) {
  function update(section: SectionKey, field: "view" | "edit", checked: boolean) {
    const next: PermissionMap = { ...value, [section]: { ...value[section], [field]: checked } }
    // Edit requires view; granting edit auto-grants view, removing view removes edit.
    if (field === "edit" && checked) next[section].view = true
    if (field === "view" && !checked) next[section].edit = false
    onChange(next)
  }

  const allView = SECTIONS.every((s) => value[s.key].view)
  const allEdit = SECTIONS.every((s) => value[s.key].edit)

  function toggleAll(field: "view" | "edit", checked: boolean) {
    const next = { ...value } as PermissionMap
    for (const s of SECTIONS) {
      next[s.key] = { ...next[s.key], [field]: checked }
      if (field === "edit" && checked) next[s.key].view = true
      if (field === "view" && !checked) next[s.key].edit = false
    }
    onChange(next)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-right text-sm">
        <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">القسم</th>
            <th className="w-24 px-3 py-2 text-center font-medium">
              <label className="flex items-center justify-center gap-1.5">
                <Checkbox checked={allView} onCheckedChange={(c) => toggleAll("view", !!c)} />
                عرض
              </label>
            </th>
            <th className="w-24 px-3 py-2 text-center font-medium">
              <label className="flex items-center justify-center gap-1.5">
                <Checkbox checked={allEdit} onCheckedChange={(c) => toggleAll("edit", !!c)} />
                تعديل
              </label>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {SECTIONS.map((s) => (
            <tr key={s.key} className="hover:bg-muted/30">
              <td className="px-3 py-2 font-medium text-foreground">{s.label}</td>
              <td className="px-3 py-2 text-center">
                <Checkbox
                  checked={value[s.key].view}
                  onCheckedChange={(c) => update(s.key, "view", !!c)}
                  aria-label={`عرض ${s.label}`}
                />
              </td>
              <td className="px-3 py-2 text-center">
                <Checkbox
                  checked={value[s.key].edit}
                  onCheckedChange={(c) => update(s.key, "edit", !!c)}
                  aria-label={`تعديل ${s.label}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
