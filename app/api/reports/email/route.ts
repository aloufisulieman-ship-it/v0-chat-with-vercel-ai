import { NextResponse } from "next/server"
import { Resend } from "resend"
import { requireUser } from "@/lib/session"

export const runtime = "nodejs"

// Sends a generated report PDF as an email attachment via Resend.
// The PDF is produced on the client and posted here as a base64 string.
export async function POST(req: Request) {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "لم يتم إعداد مفتاح Resend" }, { status: 500 })
  }

  let body: {
    to?: string
    subject?: string
    message?: string
    fileName?: string
    pdfBase64?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 })
  }

  const { to, subject, message, fileName, pdfBase64 } = body
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!to || !emailRegex.test(to)) {
    return NextResponse.json({ error: "البريد الإلكتروني غير صالح" }, { status: 400 })
  }
  if (!pdfBase64) {
    return NextResponse.json({ error: "ملف التقرير مفقود" }, { status: 400 })
  }

  // Strip an optional data URL prefix before decoding.
  const base64 = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64
  const content = Buffer.from(base64, "base64")

  const resend = new Resend(apiKey)
  const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

  const { error } = await resend.emails.send({
    from: `تقارير السلامة <${fromAddress}>`,
    to: [to],
    subject: subject || "تقرير نظام إدارة السلامة",
    html: `<div dir="rtl" style="font-family:system-ui,Tahoma,sans-serif;font-size:14px;color:#0f172a;line-height:1.7;">
      <p>${(message || "مرفق طيه التقرير المطلوب من نظام إدارة الصحة والسلامة والبيئة.").replace(/</g, "&lt;")}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
      <p style="color:#64748b;font-size:12px;">تم الإرسال آلياً من نظام إدارة الصحة والسلامة والبيئة (HSE).</p>
    </div>`,
    attachments: [
      {
        filename: fileName || "report.pdf",
        content,
      },
    ],
  })

  if (error) {
    return NextResponse.json({ error: error.message || "فشل إرسال البريد" }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
