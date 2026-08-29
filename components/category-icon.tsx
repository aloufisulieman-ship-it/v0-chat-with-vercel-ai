import {
  Truck,
  Forklift,
  Users,
  PersonStanding,
  Footprints,
  HardHat,
  ShieldAlert,
  ClipboardCheck,
  Flame,
  Droplet,
  Construction,
  TrafficCone,
  type LucideIcon,
} from "lucide-react"

// خريطة أسماء الأيقونات النصية (المخزّنة لفئات الجولة) إلى مكوّنات lucide-react.
const ICON_MAP: Record<string, LucideIcon> = {
  truck: Truck,
  forklift: Forklift,
  users: Users,
  "person-standing": PersonStanding,
  footprints: Footprints,
  "hard-hat": HardHat,
  "shield-alert": ShieldAlert,
  "clipboard-check": ClipboardCheck,
  flame: Flame,
  droplet: Droplet,
  construction: Construction,
  "traffic-cone": TrafficCone,
}

export function categoryIconComponent(name: string): LucideIcon {
  return ICON_MAP[name] ?? ClipboardCheck
}

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = categoryIconComponent(name)
  return <Icon className={className} />
}
