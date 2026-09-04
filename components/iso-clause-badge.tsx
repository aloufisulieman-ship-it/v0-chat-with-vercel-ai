import { ShieldCheck } from "lucide-react"
import { clauseById, formatClauseRef } from "@/lib/iso45001-clauses"
import type { Locale } from "@/lib/i18n/config"

// شارة مرجع بند ISO 45001 تُعرَض أعلى عنوان كل وحدة (مثال: ISO 45001 – 6.1.2).
// مكوّن عرضي بحت يعمل في الخادم والعميل؛ يقبل بنداً واحداً أو أكثر.
export function IsoClauseBadge({
  ids,
  locale,
  className = "",
}: {
  ids: string | string[]
  locale: Locale
  className?: string
}) {
  const list = Array.isArray(ids) ? ids : [ids]
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {list.map((id) => {
        const clause = clauseById[id]
        const title = clause ? (locale === "en" ? clause.en : clause.ar) : id
        return (
          <span
            key={id}
            title={title}
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
          >
            <ShieldCheck className="size-3" aria-hidden />
            <span dir="ltr">{formatClauseRef(id)}</span>
          </span>
        )
      })}
    </span>
  )
}
