import { TrendingUp, TrendingDown, MapPin } from "lucide-react"
import { riskAreas, recentTasks, projects, palette, type TaskStatus } from "./mock-data"

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col rounded-xl border p-5 transition-shadow hover:shadow-lg hover:shadow-black/30"
      style={{ backgroundColor: palette.card, borderColor: palette.divider }}
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold" style={{ color: palette.text }}>
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs" style={{ color: palette.muted }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

export function RiskAreasList() {
  return (
    <Panel title="أعلى مناطق الخطورة" subtitle="حسب عدد الحالات المسجلة">
      <ul className="flex flex-col gap-3">
        {riskAreas.map((area) => {
          const Arrow = area.trend === "up" ? TrendingUp : TrendingDown
          const color = area.trend === "up" ? palette.red : palette.green
          return (
            <li
              key={area.name}
              className="flex items-center justify-between rounded-lg p-3"
              style={{ backgroundColor: palette.bg }}
            >
              <span className="flex items-center gap-2.5 text-sm" style={{ color: palette.text }}>
                <MapPin className="size-4" style={{ color: palette.accent }} />
                {area.name}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: palette.text }}>
                  {area.cases}
                </span>
                <Arrow className="size-4" style={{ color }} />
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

const statusConfig: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  done: { label: "مكتمل", color: palette.green, bg: "rgba(52,211,153,0.12)" },
  progress: { label: "قيد التنفيذ", color: palette.accent, bg: palette.accentSoft },
  scheduled: { label: "مجدول", color: palette.blue, bg: "rgba(96,165,250,0.12)" },
}

export function RecentTasksList() {
  return (
    <Panel title="المهام الحديثة" subtitle="آخر الأنشطة الميدانية">
      <ul className="flex flex-col gap-3">
        {recentTasks.map((task, i) => {
          const cfg = statusConfig[task.status]
          return (
            <li key={i} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: palette.text }}>
                  {task.title}
                </p>
                <p className="truncate text-xs" style={{ color: palette.muted }}>
                  {task.meta}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ color: cfg.color, backgroundColor: cfg.bg }}
              >
                {cfg.label}
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

export function ProjectsList() {
  return (
    <Panel title="المشاريع الجارية" subtitle="نسبة الإنجاز">
      <ul className="flex flex-col gap-4">
        {projects.map((project) => (
          <li key={project.name}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span style={{ color: palette.text }}>{project.name}</span>
              <span className="font-semibold" style={{ color: palette.accent }} dir="ltr">
                {project.progress}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: palette.bg }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${project.progress}%`, backgroundColor: palette.accent }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
