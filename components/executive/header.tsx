import { Search, Bell, Settings, ShieldCheck } from "lucide-react"
import { palette } from "./mock-data"

export function ExecutiveHeader() {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b px-4 py-3 backdrop-blur md:px-6"
      style={{ backgroundColor: `${palette.card}cc`, borderColor: palette.divider }}
    >
      {/* الشعار على اليمين (RTL) */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex size-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: palette.accent, color: palette.bg }}
        >
          <ShieldCheck className="size-5" />
        </div>
        <div className="flex items-center gap-1.5 text-lg font-bold" style={{ color: palette.text }}>
          <span>HSE</span>
          <span style={{ color: palette.divider }}>|</span>
          <span style={{ color: palette.accent }}>المدير</span>
        </div>
      </div>

      {/* الأدوات على اليسار */}
      <div className="flex items-center gap-1">
        {[
          { icon: Search, label: "بحث" },
          { icon: Bell, label: "الإشعارات", dot: true },
          { icon: Settings, label: "الإعدادات" },
        ].map(({ icon: Icon, label, dot }) => (
          <button
            key={label}
            aria-label={label}
            className="relative rounded-lg p-2.5 transition-colors"
            style={{ color: palette.muted }}
          >
            <Icon className="size-5" />
            {dot && (
              <span
                className="absolute right-2 top-2 size-2 rounded-full"
                style={{ backgroundColor: palette.accent }}
              />
            )}
          </button>
        ))}
      </div>
    </header>
  )
}
