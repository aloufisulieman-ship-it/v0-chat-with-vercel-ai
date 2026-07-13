import { cn } from "@/lib/utils"
import { normalizeFinanceStatus } from "@/lib/finance-status"
import { CheckCircle2, Clock } from "lucide-react"

/**
 * شارة حالة المالية للمخالفات الخارجية — تظهر لجميع المستخدمين (عرض فقط).
 * - closed: "تم الإغلاق من المالية" (أخضر)
 * - pending/in_review: "قيد المعالجة لدى المالية" (كهرماني)
 */
export function FinanceStatusBadge({ financeStatus, className }: { financeStatus: string | null | undefined; className?: string }) {
  const status = normalizeFinanceStatus(financeStatus)
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
      {isClosed ? "تم الإغلاق من المالية" : "قيد المعالجة لدى المالية"}
    </span>
  )
}
