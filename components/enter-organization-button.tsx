"use client"

import { useTransition } from "react"
import { LogIn, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { enterOrganization } from "@/app/actions/platform"

// زر "دخول" لكل مؤسسة — يستدعي إجراء الدخول (يضبط الكوكي ثم يوجّه للوحة المؤسسة).
export function EnterOrganizationButton({ orgId }: { orgId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      className="gap-2"
      disabled={pending}
      onClick={() => startTransition(() => enterOrganization(orgId))}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
      دخول المساحة
    </Button>
  )
}
