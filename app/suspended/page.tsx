import { redirect } from "next/navigation"
import { Ban, ShieldAlert } from "lucide-react"
import { getCurrentUser } from "@/lib/session"
import { Card } from "@/components/ui/card"
import { SignOutButton } from "@/components/sign-out-button"
import { getServerT } from "@/lib/i18n/server"

// صفحة الحجب: يصل إليها المستخدم الموقوف/المحظور من حارس الجلسة (requireUser).
// لا تعرض أي بيانات من التطبيق؛ خيارها الوحيد تسجيل الخروج.
export default async function SuspendedPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  if (user.accountStatus !== "suspended" && user.accountStatus !== "banned") redirect("/")

  const banned = user.accountStatus === "banned"
  const { locale } = await getServerT()
  const en = locale === "en"

  const title = banned
    ? en ? "This account has been banned" : "تم حظر هذا الحساب"
    : en ? "Your account is suspended" : "حسابك موقوف مؤقتاً"
  const body = banned
    ? en
      ? "Access to the system has been permanently revoked. Contact the system administrator if you believe this is a mistake."
      : "أُلغي وصولك إلى النظام نهائياً. تواصل مع مسؤول النظام إن كنت تعتقد أن ذلك حدث عن طريق الخطأ."
    : en
      ? "An administrator has temporarily suspended your access. Contact the system administrator to restore it."
      : "قام مسؤول النظام بإيقاف وصولك مؤقتاً. يرجى التواصل مع مسؤول النظام لإعادة التفعيل."

  return (
    <main className="min-h-svh bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          {banned ? <Ban className="size-7" aria-hidden /> : <ShieldAlert className="size-7" aria-hidden />}
        </div>
        <h1 className="text-xl font-semibold text-foreground text-balance">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">{body}</p>
        <p className="mt-4 text-xs text-muted-foreground" dir="ltr">{user.email}</p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </Card>
    </main>
  )
}
