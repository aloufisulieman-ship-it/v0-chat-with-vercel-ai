"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { searchApprovedOrganizations, type OrgOption } from "@/app/actions/org-directory"
import { useI18n } from "@/lib/i18n/client"

// حقل بحث (typeahead) عن المؤسسات المعتمدة فقط. لا يعرض أي قائمة قبل كتابة حرفين،
// ولا يكشف قائمة المؤسسات كاملة. عند الاختيار يُثبّت المعرّف؛ وأي تعديل لاحق يُلغي
// الاختيار فيُجبَر المستخدم على إعادة الاختيار من النتائج المطابقة.
export function OrgAutocomplete({
  onSelect,
  disabled,
}: {
  onSelect: (org: OrgOption | null) => void
  disabled?: boolean
}) {
  const { t } = useI18n()
  const [text, setText] = useState("")
  const [options, setOptions] = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<OrgOption | null>(null)
  const [searched, setSearched] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // بحث مؤجَّل (debounce) لتقليل الطلبات أثناء الكتابة.
  useEffect(() => {
    const q = text.trim()
    if (selected && selected.name === text) return // اختيار مثبّت، لا نعيد البحث
    if (q.length < 2) {
      setOptions([])
      setSearched(false)
      setOpen(false)
      return
    }
    let active = true
    setLoading(true)
    const id = setTimeout(async () => {
      const res = await searchApprovedOrganizations(q)
      if (!active) return
      setOptions(res)
      setSearched(true)
      setLoading(false)
      setOpen(true)
    }, 250)
    return () => {
      active = false
      clearTimeout(id)
    }
  }, [text, selected])

  // إغلاق القائمة عند النقر خارج الحقل.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  function handleChange(v: string) {
    setText(v)
    if (selected) {
      setSelected(null)
      onSelect(null)
    }
  }

  function choose(org: OrgOption) {
    setSelected(org)
    setText(org.name)
    onSelect(org)
    setOpen(false)
  }

  const showNoResults = open && searched && !loading && options.length === 0 && text.trim().length >= 2

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Input
          id="organization"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (options.length > 0 && !selected) setOpen(true)
          }}
          disabled={disabled}
          autoComplete="off"
          placeholder={t("auth.orgSearchPlaceholder")}
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
        {loading && (
          <Loader2 className="absolute top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground ltr:right-3 rtl:left-3" />
        )}
        {selected && !loading && (
          <Check className="absolute top-1/2 -translate-y-1/2 size-4 text-primary ltr:right-3 rtl:left-3" />
        )}
      </div>

      {open && options.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected?.id === o.id}
                onClick={() => choose(o)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-start text-sm hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showNoResults && (
        <p className="mt-2 text-xs text-muted-foreground">{t("auth.orgNotFoundHint")}</p>
      )}
    </div>
  )
}
