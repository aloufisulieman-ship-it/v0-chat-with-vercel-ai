import Image from "next/image"
import { cn } from "@/lib/utils"

// الأيقونة فقط (الدرع + العين) بخلفية شفافة — تصلح للمساحات الضيقة وللخلفيات الفاتحة والداكنة.
export function RaqeebMark({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/raqeeb-icon.png"
      alt="شعار رقيب"
      width={128}
      height={128}
      priority={priority}
      className={cn("object-contain", className)}
    />
  )
}

// الشعار الكامل: الأيقونة + النص العربي والإنجليزي، مؤلَّف بعناصر HTML لضمان وضوح
// الخط العربي (Cairo) وتكيّفه مع الثيم بألوان الهوية (الأخضر الداكن والذهبي).
export function RaqeebLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <RaqeebMark className="size-20 shrink-0" priority />
      <div className="flex flex-col leading-tight">
        <span className="text-3xl font-extrabold tracking-tight text-primary">رقيب</span>
        <span className="mt-0.5 text-sm font-medium text-muted-foreground text-pretty">
          لأنظمة السلامة والصحة المهنية
        </span>
        <span className="mt-1 text-xs font-bold tracking-wide text-accent" dir="ltr">
          RAQEEB — HSE SAFETY SYSTEMS
        </span>
      </div>
    </div>
  )
}
