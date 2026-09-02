"use server"

import { db } from "@/lib/db"
import { emailAccount, user as userTable } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { decryptSecret, encryptSecret } from "@/lib/email-accounts/crypto"
import { providers, isOAuthProviderId, type OAuthProviderId } from "@/lib/email-accounts/providers"

// قيم برنامج البريد المفضّل. "device" = تطبيق البريد على الجهاز (.eml/Share)،
// "copy" = نسخ النص وتنزيل المرفق. null = اسأل في كل مرة.
export type EmailProviderChoice = OAuthProviderId | "device" | "copy"

export type EmailAccountsStatus = {
  preferred: EmailProviderChoice | null
  providers: Record<
    OAuthProviderId,
    { configured: boolean; connected: boolean; emailAddress: string }
  >
}

const CHOICES: EmailProviderChoice[] = ["microsoft", "google", "device", "copy"]

export async function getEmailAccountsStatus(): Promise<EmailAccountsStatus> {
  const u = await requireUser()
  const [row] = await db
    .select({ preferred: userTable.preferredEmailProvider })
    .from(userTable)
    .where(eq(userTable.id, u.id))
    .limit(1)
  const accounts = await db
    .select({ provider: emailAccount.provider, emailAddress: emailAccount.emailAddress })
    .from(emailAccount)
    .where(eq(emailAccount.userId, u.id))
  const byProvider = new Map(accounts.map((a) => [a.provider, a.emailAddress]))
  const pref = row?.preferred
  return {
    preferred: CHOICES.includes(pref as EmailProviderChoice) ? (pref as EmailProviderChoice) : null,
    providers: {
      microsoft: {
        configured: providers.microsoft.isConfigured(),
        connected: byProvider.has("microsoft"),
        emailAddress: byProvider.get("microsoft") || "",
      },
      google: {
        configured: providers.google.isConfigured(),
        connected: byProvider.has("google"),
        emailAddress: byProvider.get("google") || "",
      },
    },
  }
}

// حفظ/مسح التفضيل الافتراضي. null = اسأل في كل مرة.
export async function setPreferredEmailProvider(choice: EmailProviderChoice | null) {
  const u = await requireUser()
  if (choice !== null && !CHOICES.includes(choice)) throw new Error("خيار غير صالح")
  await db
    .update(userTable)
    .set({ preferredEmailProvider: choice, updatedAt: new Date() })
    .where(eq(userTable.id, u.id))
  revalidatePath("/settings")
  return { ok: true }
}

export async function disconnectEmailAccount(provider: OAuthProviderId) {
  const u = await requireUser()
  if (!isOAuthProviderId(provider)) throw new Error("مزوّد غير صالح")
  await db.delete(emailAccount).where(and(eq(emailAccount.userId, u.id), eq(emailAccount.provider, provider)))
  // إن كان هذا المزوّد هو الافتراضي، امسح التفضيل ليُسأل المستخدم مجدداً.
  await db
    .update(userTable)
    .set({ preferredEmailProvider: null, updatedAt: new Date() })
    .where(and(eq(userTable.id, u.id), eq(userTable.preferredEmailProvider, provider)))
  revalidatePath("/settings")
  return { ok: true }
}

// يجلب رمز وصول صالحاً لحساب المستخدم (يجدّده عند الانتهاء ويحفظه مشفّراً).
async function getValidAccessToken(userId: string, provider: OAuthProviderId): Promise<string> {
  const [acc] = await db
    .select()
    .from(emailAccount)
    .where(and(eq(emailAccount.userId, userId), eq(emailAccount.provider, provider)))
    .limit(1)
  if (!acc) throw new Error("لم يتم ربط هذا الحساب بعد")

  const stillValid = acc.accessTokenExpiresAt && acc.accessTokenExpiresAt.getTime() > Date.now() + 30_000
  if (stillValid) return decryptSecret(acc.accessTokenEnc)

  if (!acc.refreshTokenEnc) throw new Error("انتهت صلاحية الربط؛ يرجى إعادة ربط الحساب من الإعدادات")
  const fresh = await providers[provider].refreshAccessToken(decryptSecret(acc.refreshTokenEnc))
  await db
    .update(emailAccount)
    .set({
      accessTokenEnc: encryptSecret(fresh.accessToken),
      refreshTokenEnc: fresh.refreshToken ? encryptSecret(fresh.refreshToken) : acc.refreshTokenEnc,
      accessTokenExpiresAt: fresh.expiresAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(emailAccount.id, acc.id))
  return fresh.accessToken
}

const MAX_PDF_BYTES = 3 * 1024 * 1024 // حد Graph لمرفق واحد في sendMail ~3MB

// الإرسال المباشر من بريد المستخدم المرتبط مع مرفق PDF (base64 بدون بادئة data:).
export async function sendReportEmail(input: {
  provider: OAuthProviderId
  to: string
  subject: string
  body: string
  fileName: string
  pdfBase64: string
}) {
  const u = await requireUser()
  if (!isOAuthProviderId(input.provider)) throw new Error("مزوّد غير صالح")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) throw new Error("بريد المستلم غير صالح")
  const base64 = input.pdfBase64.replace(/^data:[^;]+;(?:filename=[^;]+;)?base64,/, "")
  const approxBytes = Math.floor((base64.length * 3) / 4)
  if (approxBytes > MAX_PDF_BYTES) throw new Error("حجم التقرير يتجاوز 3 ميغابايت؛ قلّل عدد الصور")

  const accessToken = await getValidAccessToken(u.id, input.provider)
  await providers[input.provider].sendMail(accessToken, {
    to: input.to,
    subject: input.subject,
    body: input.body,
    attachment: { fileName: input.fileName, contentBase64: base64, contentType: "application/pdf" },
  })
  return { ok: true }
}
