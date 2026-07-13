import { cn } from "@/lib/utils"
import { normalizeHrStatus } from "@/lib/hr-status"
import { CheckCircle2, Clock } from "lucide-react"

/**
 * شارة حالة الموارد البشرية للبنود الداخلية — تظهر لجميع المستخدمين (عرض فقط).
 * - closed: "تم الإغلاق من الموارد البشرية" (أخضر)
 * - pending/in_review: "قيد المعالجة لدى الموارد البشرية" (كهرماني)
 */
export function HrStatusBadge({ hrStatus, className }: { hrStatus: string | null | undefined; className?: string }) {
  const status = normalizeHrStatus(hrStatus)
  const isClosed = status === "closed"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        isClosed
          ? "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-accent/30 bg-accent/15 text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      {isClosed ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
      {isClosed ? "تم الإغلاق من الموارد البشرية" : "قيد المعالجة لدى الموارد البشرية"}
    </span>
  )
}
