// مكوّن مشترك لـ"الإرسال بالبريد" في وحدتي المخالفات والحوادث.
//
// يوفّر:
//  1) قالب الرسالة الرسمي (عنوان + نص RTL) مع حذف أسطر الحقول الفارغة بالكامل.
//  2) مولّد ملف .eml (رسالة MIME كاملة multipart/mixed) مع PDF مرفق base64
//     وترميز عناوين UTF-8 صحيح (=?UTF-8?B?...?=) — يفتحه Outlook وغيره برسالة جاهزة.
//  3) سلسلة تراجع تلقائية (fallback chain) لفتح بريد الجهاز مع المرفق:
//        Web Share API (جوال/أجهزة داعمة) → ملف .eml (سطح المكتب) → mailto (احتياط أخير)
//     أي تعليمات للمستخدم تُعرض كإشعار داخل التطبيق فقط، لا داخل نص الرسالة إطلاقاً.

export type EmailLocale = "ar" | "en"

export type EmailExportContext =
  | {
      kind: "violation"
      number: string
      type: string
      source?: string
      date?: string
      time?: string
      location?: string
      severity?: string
      classification?: string
      status?: string
    }
  | {
      kind: "incident"
      number: string
      type: string
      date?: string
      time?: string
      location?: string
      severity?: string
      injuries?: string
      status?: string
    }

// بيانات التواصل المُلحقة تلقائياً بالتوقيع الرسمي في نهاية الرسالة.
export type EmailSenderInfo = {
  companyName?: string
  phone?: string
  email?: string
  address?: string
}

export type EmailContent = { subject: string; body: string; fileName: string }

const DEFAULT_COMPANY_AR = "شركة الأيادي الفضية الحديثة"
const DEFAULT_COMPANY_EN = "Modern Silver Hands Company"

// علامة RTL في بداية كل سطر تضمن اتجاهاً صحيحاً حتى في عملاء البريد التي تتجاهل اتجاه النص.
const RLM = "\u200F"

function isEmpty(v: string | undefined | null) {
  if (!v) return true
  const s = v.trim()
  return s === "" || s === "-" || s === "—"
}

// يبني سطر "التسمية: القيمة" أو يُعيد null إذا كانت القيمة فارغة (فيُحذف السطر كلياً).
function line(label: string, value: string | undefined | null): string | null {
  return isEmpty(value) ? null : `${label}: ${value!.trim()}`
}

// التاريخ والوقت في سطر واحد؛ يُحذف السطر إن غاب الاثنان، ويُعرض المتاح منهما فقط.
function dateTimeLine(label: string, date?: string, time?: string): string | null {
  const d = isEmpty(date) ? "" : date!.trim()
  const t = isEmpty(time) ? "" : time!.trim()
  if (!d && !t) return null
  return `${label}: ${[d, t].filter(Boolean).join(" - ")}`
}

// اسم ملف PDF الرسمي: تقرير-مخالفة-{رقم}.pdf أو تقرير-حادث-{رقم}.pdf
export function reportFileName(ctx: EmailExportContext, locale: EmailLocale = "ar") {
  const safeNo = (ctx.number || "").replace(/[\\/:*?"<>|\s]+/g, "-") || "بدون-رقم"
  if (locale === "en") {
    return `${ctx.kind === "violation" ? "violation-report" : "incident-report"}-${safeNo}.pdf`
  }
  return `${ctx.kind === "violation" ? "تقرير-مخالفة" : "تقرير-حادث"}-${safeNo}.pdf`
}

export function buildEmailContent(
  ctx: EmailExportContext,
  opts: { recipientName?: string; sender?: EmailSenderInfo; locale?: EmailLocale } = {},
): EmailContent {
  const locale = opts.locale ?? "ar"
  const fileName = reportFileName(ctx, locale)
  return locale === "en"
    ? buildEnglish(ctx, fileName, opts.recipientName, opts.sender)
    : buildArabic(ctx, fileName, opts.recipientName, opts.sender)
}

function signatureBlockAr(sender?: EmailSenderInfo) {
  const company = sender?.companyName?.trim() || DEFAULT_COMPANY_AR
  const contact = [
    line("هاتف", sender?.phone),
    line("البريد الإلكتروني", sender?.email),
    line("العنوان", sender?.address),
  ].filter(Boolean) as string[]
  return ["إدارة الصحة والسلامة والبيئة", company, ...contact]
}

function buildArabic(
  ctx: EmailExportContext,
  fileName: string,
  recipientName?: string,
  sender?: EmailSenderInfo,
): EmailContent {
  const greeting = isEmpty(recipientName)
    ? "السادة المحترمين،"
    : `السادة / ${recipientName!.trim()} المحترمين،`

  let subject: string
  let intro: string
  let details: (string | null)[]
  let closing: string

  if (ctx.kind === "violation") {
    subject = isEmpty(ctx.type)
      ? `تقرير مخالفة رقم ${ctx.number}`
      : `تقرير مخالفة رقم ${ctx.number} — ${ctx.type}`
    intro = "نفيدكم بأنه تم تسجيل المخالفة التالية في نظام إدارة الصحة والسلامة والبيئة:"
    details = [
      line("رقم المخالفة", ctx.number),
      line("نوع المخالفة", ctx.type),
      line("مصدر الرصد", ctx.source),
      dateTimeLine("التاريخ والوقت", ctx.date, ctx.time),
      line("الموقع", ctx.location),
      line("درجة الخطورة", ctx.severity),
      line("التصنيف", ctx.classification),
      line("حالة المعالجة", ctx.status),
    ]
    closing = "مرفق طيه تقرير المخالفة بصيغة PDF للاطلاع واتخاذ الإجراء اللازم وفق الأنظمة المعتمدة."
  } else {
    subject = isEmpty(ctx.type)
      ? `تقرير حادث رقم ${ctx.number}`
      : `تقرير حادث رقم ${ctx.number} — ${ctx.type}`
    intro = "نفيدكم بأنه تم تسجيل الحادث التالي في نظام إدارة الصحة والسلامة والبيئة:"
    details = [
      line("رقم الحادث", ctx.number),
      line("نوع الحادث", ctx.type),
      dateTimeLine("التاريخ والوقت", ctx.date, ctx.time),
      line("الموقع", ctx.location),
      line("درجة الخطورة", ctx.severity),
      line("الإصابات", ctx.injuries),
      line("حالة التحقيق", ctx.status),
    ]
    closing = "مرفق طيه تقرير الحادث بصيغة PDF للاطلاع واتخاذ الإجراءات التصحيحية اللازمة."
  }

  const paragraphs: string[][] = [
    [greeting],
    ["تحية طيبة وبعد،"],
    [intro],
    details.filter(Boolean) as string[],
    [closing],
    ["وتفضلوا بقبول فائق الاحترام والتقدير،"],
    signatureBlockAr(sender),
  ]

  const body = paragraphs
    .filter((p) => p.length > 0)
    .map((p) => p.map((l) => RLM + l).join("\n"))
    .join("\n\n")

  return { subject, body, fileName }
}

function buildEnglish(
  ctx: EmailExportContext,
  fileName: string,
  recipientName?: string,
  sender?: EmailSenderInfo,
): EmailContent {
  const greeting = isEmpty(recipientName) ? "Dear Sir/Madam," : `Dear ${recipientName!.trim()},`
  const company = sender?.companyName?.trim() || DEFAULT_COMPANY_EN
  const contact = [
    line("Phone", sender?.phone),
    line("Email", sender?.email),
    line("Address", sender?.address),
  ].filter(Boolean) as string[]

  let subject: string
  let intro: string
  let details: (string | null)[]
  let closing: string

  if (ctx.kind === "violation") {
    subject = isEmpty(ctx.type)
      ? `Violation Report No. ${ctx.number}`
      : `Violation Report No. ${ctx.number} — ${ctx.type}`
    intro = "Please be informed that the following violation has been recorded in the HSE Management System:"
    details = [
      line("Violation No.", ctx.number),
      line("Violation Type", ctx.type),
      line("Detection Source", ctx.source),
      dateTimeLine("Date & Time", ctx.date, ctx.time),
      line("Location", ctx.location),
      line("Severity", ctx.severity),
      line("Classification", ctx.classification),
      line("Processing Status", ctx.status),
    ]
    closing = "Attached is the violation report in PDF format for your review and necessary action per approved regulations."
  } else {
    subject = isEmpty(ctx.type)
      ? `Incident Report No. ${ctx.number}`
      : `Incident Report No. ${ctx.number} — ${ctx.type}`
    intro = "Please be informed that the following incident has been recorded in the HSE Management System:"
    details = [
      line("Incident No.", ctx.number),
      line("Incident Type", ctx.type),
      dateTimeLine("Date & Time", ctx.date, ctx.time),
      line("Location", ctx.location),
      line("Severity", ctx.severity),
      line("Injuries", ctx.injuries),
      line("Investigation Status", ctx.status),
    ]
    closing = "Attached is the incident report in PDF format for your review and the necessary corrective actions."
  }

  const body = [
    greeting,
    intro,
    (details.filter(Boolean) as string[]).join("\n"),
    closing,
    "Yours faithfully,",
    ["Health, Safety & Environment Department", company, ...contact].join("\n"),
  ].join("\n\n")

  return { subject, body, fileName }
}

// ─────────────────────────────── MIME / .eml ───────────────────────────────

function utf8ToBase64(s: string) {
  const bytes = new TextEncoder().encode(s)
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

// ترميز عنوان MIME (Subject/اسم الملف) بصيغة RFC 2047 ليعرض العربية بشكل صحيح.
function encodeHeaderWord(s: string) {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(s) ? s : `=?UTF-8?B?${utf8ToBase64(s)}?=`
}

function wrap76(b64: string) {
  return b64.replace(/(.{76})/g, "$1\r\n")
}

// اسم الملف في Content-Disposition بصيغة RFC 2231 (filename*=UTF-8''...) لدعم العربية.
function encodeFilenameParam(name: string) {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'")
  return `filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export function buildEml(opts: {
  to?: string
  subject: string
  body: string
  pdfBase64: string // base64 خام بدون بادئة data:
  fileName: string
}): string {
  const boundary = `----=_HSE_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
  const now = new Date().toUTCString()
  const headers = [
    `Date: ${now}`,
    opts.to ? `To: ${opts.to}` : null,
    `Subject: ${encodeHeaderWord(opts.subject)}`,
    // X-Unsent يجعل Outlook يفتح الملف في وضع "رسالة جديدة" قابلة للإرسال بدل وضع القراءة.
    `X-Unsent: 1`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean) as string[]

  const textPart = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8; format=flowed`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrap76(utf8ToBase64(opts.body)),
  ].join("\r\n")

  const pdfPart = [
    `--${boundary}`,
    `Content-Type: application/pdf; name="${opts.fileName.replace(/[^\x20-\x7E]/g, "_")}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; ${encodeFilenameParam(opts.fileName)}`,
    ``,
    wrap76(opts.pdfBase64.replace(/\s+/g, "")),
  ].join("\r\n")

  return [headers.join("\r\n"), ``, textPart, pdfPart, `--${boundary}--`, ``].join("\r\n")
}

// ─────────────────────────── fallback chain ───────────────────────────

export type EmailExportMethod = "share" | "eml" | "mailto"

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => {
      const s = String(r.result || "")
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s)
    }
    r.onerror = () => reject(new Error("Failed to read PDF blob"))
    r.readAsDataURL(blob)
  })
}

// يُنفّذ سلسلة التراجع ويُعيد الطريقة التي نجحت فعلياً ليُعرض الإشعار المناسب.
export async function exportReportByEmail(opts: {
  pdfBlob: Blob
  content: EmailContent
  to?: string
}): Promise<EmailExportMethod> {
  const { pdfBlob, content, to } = opts
  const file = new File([pdfBlob], content.fileName, { type: "application/pdf" })

  // (1) Web Share API مع ملف — يفتح قائمة المشاركة بالجهاز وتطبيقات البريد والملف مرفق فعلياً.
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator) : undefined
  if (nav && typeof nav.share === "function" && typeof nav.canShare === "function") {
    try {
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: content.subject, text: content.body })
        return "share"
      }
    } catch (err) {
      // إلغاء المستخدم للمشاركة ليس فشلاً يستدعي التراجع إلى طرق أخرى.
      if (err instanceof Error && err.name === "AbortError") throw err
      // أي خطأ آخر: نتابع إلى المرحلة التالية.
    }
  }

  // (2) ملف .eml — رسالة MIME كاملة بالمرفق؛ فتحه يُطلق Outlook/البريد الافتراضي برسالة جاهزة.
  try {
    const pdfBase64 = await blobToBase64(pdfBlob)
    const eml = buildEml({ to, subject: content.subject, body: content.body, pdfBase64, fileName: content.fileName })
    const emlName = content.fileName.replace(/\.pdf$/i, "") + ".eml"
    triggerDownload(new Blob([eml], { type: "message/rfc822" }), emlName)
    return "eml"
  } catch {
    // نتابع إلى الاحتياط الأخير.
  }

  // (3) الاحتياط الأخير: mailto بالعنوان والنص فقط (لا يدعم المرفقات).
  const a = document.createElement("a")
  a.href = `mailto:${to ? encodeURIComponent(to) : ""}?subject=${encodeURIComponent(content.subject)}&body=${encodeURIComponent(content.body)}`
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  return "mailto"
}

// نصوص واجهة نافذة تجهيز البريد.
export function emailExportLabels(locale: EmailLocale = "ar") {
  if (locale === "en") {
    return {
      title: "Send report by email",
      description: "Your device's mail app will open with the PDF report attached automatically.",
      recipientName: "Recipient (optional)",
      recipientNamePlaceholder: "e.g. Human Resources Department",
      recipientEmail: "Recipient email (optional)",
      attachNote: "A full single-page PDF report (data, photos and signatures) is attached automatically.",
      openMail: "Open mail app",
      preparing: "Preparing...",
    }
  }
  return {
    title: "إرسال التقرير بالبريد",
    description: "سيُفتح تطبيق البريد في جهازك مع تقرير PDF مرفقاً تلقائياً.",
    recipientName: "اسم الجهة المستلمة (اختياري)",
    recipientNamePlaceholder: "مثال: إدارة الموارد البشرية",
    recipientEmail: "بريد المستلم (اختياري)",
    attachNote: "يُرفق تقرير PDF كامل (البيانات والصور والتواقيع) ضمن صفحة واحدة تلقائياً.",
    openMail: "فتح تطبيق البريد",
    preparing: "جارٍ التجهيز...",
  }
}

// نصوص الإشعارات داخل التطبيق (ليست جزءاً من نص الرسالة).
export function emailExportNotice(method: EmailExportMethod, locale: EmailLocale = "ar") {
  if (locale === "en") {
    switch (method) {
      case "share":
        return { title: "Share sheet opened", description: "Choose your mail app — the PDF report is already attached." }
      case "eml":
        return {
          title: "Email draft ready",
          description: "An .eml draft with the PDF attached was created. Open it to launch your mail app (e.g. Outlook) with the message ready to send.",
        }
      default:
        return {
          title: "Mail app opened",
          description: "Your browser does not support automatic attachments. Download the PDF report and attach it manually.",
        }
    }
  }
  switch (method) {
    case "share":
      return { title: "تم فتح قائمة المشاركة", description: "اختر تطبيق البريد — تقرير PDF مرفق تلقائياً." }
    case "eml":
      return {
        title: "تم تجهيز رسالة البريد",
        description: "تم إنشاء مسودة .eml بالمرفق. افتحها لتنطلق في تطبيق البريد (مثل Outlook) والرسالة جاهزة للإرسال.",
      }
    default:
      return {
        title: "تم فتح تطبيق البريد",
        description: "متصفحك لا يدعم الإرفاق التلقائي. نزّل تقرير PDF وأرفقه يدوياً بالرسالة.",
      }
  }
}
