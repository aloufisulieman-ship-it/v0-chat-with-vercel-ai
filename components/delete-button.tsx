"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"

export function DeleteButton({
  id,
  action,
}: {
  id: number
  action: (id: number) => Promise<void>
}) {
  const { t } = useI18n()
  const [isPending, startTransition] = useTransition()

  function onConfirm() {
    startTransition(async () => {
      try {
        await action(id)
        toast({ title: t("deleteBtn.deletedTitle"), description: t("deleteBtn.deletedDesc") })
      } catch (err) {
        toast({
          title: t("deleteBtn.failedTitle"),
          description: err instanceof Error ? err.message : t("deleteBtn.failedDesc"),
          variant: "destructive",
        })
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label={t("deleteBtn.aria")}
          disabled={isPending}
        >
          <Trash2 className="size-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteBtn.confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteBtn.confirmDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("deleteBtn.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {t("deleteBtn.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
