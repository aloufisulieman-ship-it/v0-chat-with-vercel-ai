"use client"

import { useTransition } from "react"
import { Eye, LogOut } from "lucide-react"
import { exitOrganization } from "@/app/actions/platform"

// لافتة ثابتة أعلى كل صفحات المؤسسة أثناء دخول مسؤول المنصّة: توضّح وضع "العرض فقط"
// واسم المؤسسة، وتتيح الخروج والعودة إلى قائمة المؤسسات.
export function PlatformImpersonationBanner({ organizationName }: { organizationName: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-amber-950 md:px-6">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Eye className="size-4 shrink-0" />
        <span className="text-pretty">
          {"عرض فقط — أنت داخل مساحة "}
          <span className="font-bold">{organizationName || "مؤسسة"}</span>
          {" كمسؤول منصّة. التعديلات معطّلة."}
        </span>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => exitOrganization())}
        className="flex shrink-0 items-center gap-1.5 rounded-md bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-900 disabled:opacity-60"
      >
        <LogOut className="size-3.5" />
        {pending ? "جارٍ الخروج…" : "الخروج من عرض المؤسسة"}
      </button>
    </div>
  )
}
