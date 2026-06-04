"use client"

import { useState } from "react"
import { Loader2, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"
import { toast } from "@/hooks/use-toast"

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 8) {
      toast({ title: "كلمة المرور قصيرة", description: "يجب أن تكون 8 أحرف على الأقل.", variant: "destructive" })
      return
    }
    if (next !== confirm) {
      toast({ title: "غير متطابقة", description: "تأكيد كلمة المرور لا يطابق الكلمة الجديدة.", variant: "destructive" })
      return
    }
    setLoading(true)
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    })
    setLoading(false)
    if (error) {
      toast({
        title: "تعذّر تغيير كلمة المرور",
        description: error.message === "Invalid password" ? "كلمة المرور الحالية غير صحيحة." : "حدث خطأ، حاول مجدداً.",
        variant: "destructive",
      })
      return
    }
    toast({ title: "تم تغيير كلمة المرور", description: "سيتم استخدام كلمة المرور الجديدة في الدخول القادم." })
    setCurrent("")
    setNext("")
    setConfirm("")
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="cp-current">كلمة المرور الحالية</Label>
        <Input
          id="cp-current"
          type="password"
          dir="ltr"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cp-new">كلمة المرور الجديدة</Label>
        <Input
          id="cp-new"
          type="password"
          dir="ltr"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="8 أحرف على الأقل"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cp-confirm">تأكيد كلمة المرور</Label>
        <Input
          id="cp-confirm"
          type="password"
          dir="ltr"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={loading} className="gap-2 self-start">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        تحديث كلمة المرور
      </Button>
    </form>
  )
}
