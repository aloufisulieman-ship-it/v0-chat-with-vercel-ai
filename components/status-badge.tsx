import { cn } from "@/lib/utils"
import { statusLabels, severityLabels } from "@/lib/labels"

const statusStyles: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  in_progress: "bg-accent/15 text-amber-700 dark:text-amber-400 border-accent/30",
  investigating: "bg-accent/15 text-amber-700 dark:text-amber-400 border-accent/30",
  under_review: "bg-accent/15 text-amber-700 dark:text-amber-400 border-accent/30",
  closed: "bg-primary/10 text-primary border-primary/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  scheduled: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  pending: "bg-accent/15 text-amber-700 dark:text-amber-400 border-accent/30",
  approved: "bg-primary/10 text-primary border-primary/20",
  active: "bg-primary/10 text-primary border-primary/20",
  expired: "bg-destructive/10 text-destructive border-destructive/20",
  sufficient: "bg-primary/10 text-primary border-primary/20",
  low_stock: "bg-destructive/10 text-destructive border-destructive/20",
}

const severityStyles: Record<string, string> = {
  low: "bg-primary/10 text-primary border-primary/20",
  medium: "bg-accent/15 text-amber-700 dark:text-amber-400 border-accent/30",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        statusStyles[status] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {statusLabels[status] ?? status}
    </span>
  )
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        severityStyles[severity] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {severityLabels[severity] ?? severity}
    </span>
  )
}
