import "server-only"

// طبقة تجريد لمزوّدي البريد عبر OAuth. كل مزوّد يوفّر: بناء رابط التفويض، تبديل الكود
// برموز، تجديد رمز الوصول، جلب عنوان البريد، والإرسال مع مرفق. Microsoft مُنفَّذ بالكامل؛
// Google يتبع نفس الواجهة ويُفعَّل عند ضبط متغيراته.

export type OAuthProviderId = "microsoft" | "google"

export type OAuthTokens = {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scope?: string
}

export type SendMailInput = {
  to: string
  subject: string
  body: string
  attachment: { fileName: string; contentBase64: string; contentType: string }
}

export interface EmailProvider {
  id: OAuthProviderId
  isConfigured(): boolean
  buildAuthorizeUrl(state: string): string
  exchangeCode(code: string): Promise<OAuthTokens>
  refreshAccessToken(refreshToken: string): Promise<OAuthTokens>
  fetchEmailAddress(accessToken: string): Promise<string>
  sendMail(accessToken: string, input: SendMailInput): Promise<void>
}

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} غير مُعدّ`)
  return v
}

// ---------------- Microsoft 365 / Outlook (Microsoft Graph) ----------------
// النطاقات: Mail.Send للإرسال، User.Read لجلب البريد، offline_access لرمز التجديد.
const MS_SCOPES = ["openid", "offline_access", "User.Read", "Mail.Send"].join(" ")

function msAuthority() {
  const tenant = process.env.MICROSOFT_TENANT_ID || "common"
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`
}

async function msTokenRequest(params: Record<string, string>): Promise<OAuthTokens> {
  const res = await fetch(`${msAuthority()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required("MICROSOFT_CLIENT_ID"),
      client_secret: required("MICROSOFT_CLIENT_SECRET"),
      scope: MS_SCOPES,
      ...params,
    }),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || typeof json.access_token !== "string") {
    throw new Error(String(json.error_description || json.error || "فشل الحصول على رمز Microsoft"))
  }
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expiresAt:
      typeof json.expires_in === "number" ? new Date(Date.now() + (json.expires_in - 60) * 1000) : undefined,
    scope: typeof json.scope === "string" ? json.scope : undefined,
  }
}

export const microsoftProvider: EmailProvider = {
  id: "microsoft",
  isConfigured() {
    return !!(
      process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET &&
      process.env.MICROSOFT_REDIRECT_URI &&
      process.env.ENCRYPTION_KEY
    )
  },
  buildAuthorizeUrl(state) {
    const q = new URLSearchParams({
      client_id: required("MICROSOFT_CLIENT_ID"),
      response_type: "code",
      redirect_uri: required("MICROSOFT_REDIRECT_URI"),
      response_mode: "query",
      scope: MS_SCOPES,
      state,
      prompt: "select_account",
    })
    return `${msAuthority()}/authorize?${q}`
  },
  exchangeCode(code) {
    return msTokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: required("MICROSOFT_REDIRECT_URI"),
    })
  },
  refreshAccessToken(refreshToken) {
    return msTokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken })
  },
  async fetchEmailAddress(accessToken) {
    const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const json = (await res.json().catch(() => ({}))) as { mail?: string; userPrincipalName?: string }
    if (!res.ok) throw new Error("تعذّر جلب بريد حساب Microsoft")
    return json.mail || json.userPrincipalName || ""
  },
  async sendMail(accessToken, input) {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: "Text", content: input.body },
          toRecipients: [{ emailAddress: { address: input.to } }],
          attachments: [
            {
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: input.attachment.fileName,
              contentType: input.attachment.contentType,
              contentBytes: input.attachment.contentBase64,
            },
          ],
        },
        saveToSentItems: true,
      }),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      throw new Error(json.error?.message || `فشل الإرسال عبر Microsoft (${res.status})`)
    }
  },
}

// ---------------- Google / Gmail (المرحلة الثانية) ----------------
// نفس الواجهة؛ يُفعَّل تلقائياً عند ضبط GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI.
const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.send"].join(" ")

async function googleTokenRequest(params: Record<string, string>): Promise<OAuthTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required("GOOGLE_CLIENT_ID"),
      client_secret: required("GOOGLE_CLIENT_SECRET"),
      ...params,
    }),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || typeof json.access_token !== "string") {
    throw new Error(String(json.error_description || json.error || "فشل الحصول على رمز Google"))
  }
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expiresAt:
      typeof json.expires_in === "number" ? new Date(Date.now() + (json.expires_in - 60) * 1000) : undefined,
    scope: typeof json.scope === "string" ? json.scope : undefined,
  }
}

function toBase64Url(s: string) {
  return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export const googleProvider: EmailProvider = {
  id: "google",
  isConfigured() {
    return !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI &&
      process.env.ENCRYPTION_KEY
    )
  },
  buildAuthorizeUrl(state) {
    const q = new URLSearchParams({
      client_id: required("GOOGLE_CLIENT_ID"),
      response_type: "code",
      redirect_uri: required("GOOGLE_REDIRECT_URI"),
      scope: GOOGLE_SCOPES,
      state,
      access_type: "offline",
      prompt: "consent",
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
  },
  exchangeCode(code) {
    return googleTokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: required("GOOGLE_REDIRECT_URI"),
    })
  },
  refreshAccessToken(refreshToken) {
    return googleTokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken })
  },
  async fetchEmailAddress(accessToken) {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const json = (await res.json().catch(() => ({}))) as { email?: string }
    if (!res.ok) throw new Error("تعذّر جلب بريد حساب Google")
    return json.email || ""
  },
  async sendMail(accessToken, input) {
    const boundary = `----=_hse_${Date.now()}`
    const encSubject = `=?UTF-8?B?${Buffer.from(input.subject).toString("base64")}?=`
    const encName = `=?UTF-8?B?${Buffer.from(input.attachment.fileName).toString("base64")}?=`
    const raw = [
      `To: ${input.to}`,
      `Subject: ${encSubject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(input.body).toString("base64"),
      `--${boundary}`,
      `Content-Type: ${input.attachment.contentType}; name="${encName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${encName}"`,
      "",
      input.attachment.contentBase64,
      `--${boundary}--`,
    ].join("\r\n")
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: toBase64Url(raw) }),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      throw new Error(json.error?.message || `فشل الإرسال عبر Google (${res.status})`)
    }
  },
}

export const providers: Record<OAuthProviderId, EmailProvider> = {
  microsoft: microsoftProvider,
  google: googleProvider,
}

export function isOAuthProviderId(v: unknown): v is OAuthProviderId {
  return v === "microsoft" || v === "google"
}
