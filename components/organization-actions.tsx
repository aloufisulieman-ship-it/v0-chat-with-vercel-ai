"use client"

import { useState, useTransition } from "react"
import { LogIn, Loader2, Check, X, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  enterOrganization,
  approveOrganization,
  rejectOrganization,
  updateOrganizationName,
} from "@/app/actions/platform"

type Status = "pending" | "approved" | "rejected"

// صفّ أزرار الإجراءات لكل مؤسسة في لوحة المنصّة: اعتماد / رفض / تعديل الاسم / دخول
// المساحة. تتغيّر الأزرار حسب حالة المؤسسة الحالية.
export function OrganizationActions({
  orgId,
  status,
  name,
}: {
  orgId: string
  status: Status
  name: string
}) {
  const [pending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState(name)

  function run(fn: () => Promise<unknown>, okMsg: string) {
    startTransition(async () => {
      try {
        await fn()
        toast.success(okMsg)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذّر تنفيذ العملية")
      }
    })
  }

  function saveName() {
    const trimmed = editName.trim()
    if (!trimmed) {
      toast.error("الاسم مطلوب")
      return
    }
    startTransition(async () => {
      try {
        const res = await updateOrganizationName(orgId, trimmed)
        if (res.error) {
          toast.error(res.error)
          return
        }
        toast.success("تم تحديث اسم المؤسسة")
        setEditOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذّر حفظ الاسم")
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "pending" && (
        <Button
          size="sm"
          className="gap-2"
          disabled={pending}
          onClick={() => run(() => approveOrganization(orgId), "تم اعتماد المؤسسة")}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          اعتماد
        </Button>
      )}

      {status === "rejected" && (
        <Button
          size="sm"
          className="gap-2"
          disabled={pending}
          onClick={() => run(() => approveOrganization(orgId), "تم اعتماد المؤسسة")}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          إعادة الاعتماد
        </Button>
      )}

      {status !== "rejected" && (
        <Button
          size="sm"
          variant="outline"
          className="gap-2 text-destructive hover:text-destructive"
          disabled={pending}
          onClick={() => setRejectOpen(true)}
        >
          <X className="size-4" />
          {status === "approved" ? "تعليق" : "رفض"}
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        className="gap-2"
        disabled={pending}
        onClick={() => {
          setEditName(name)
          setEditOpen(true)
        }}
      >
        <Pencil className="size-4" />
        تعديل
      </Button>

      <Button
        size="sm"
        variant="secondary"
        className="gap-2"
        disabled={pending}
        onClick={() => startTransition(() => enterOrganization(orgId))}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        دخول المساحة
      </Button>

      {/* تأكيد الرفض/التعليق */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{status === "approved" ? "تعليق المؤسسة؟" : "رفض المؤسسة؟"}</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حجب وصول جميع مستخدمي «{name}» إلى النظام، وستظهر لهم رسالة الرفض عند تسجيل الدخول. يمكنك إعادة
              اعتمادها لاحقاً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                run(() => rejectOrganization(orgId), status === "approved" ? "تم تعليق المؤسسة" : "تم رفض المؤسسة")
                setRejectOpen(false)
              }}
            >
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* تعديل اسم المؤسسة */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل اسم المؤسسة</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`org-name-${orgId}`}>اسم المؤسسة</Label>
            <Input
              id={`org-name-${orgId}`}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button onClick={saveName} disabled={pending} className="gap-2">
              {pending && <Loader2 className="size-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
