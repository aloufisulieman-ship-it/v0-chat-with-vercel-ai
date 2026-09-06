import { expireOverduePermits } from "@/app/actions/permit-workflow"

// مسار الانتهاء التلقائي لتصاريح العمل — يُشغَّل عبر Vercel Cron (مجدول) أو يدوياً.
// يمرّ على كل المؤسسات ويحوّل التصاريح التي تجاوزت وقتها إلى "منتهٍ" مع إنشاء إشعار.
// محمي بـ CRON_SECRET إن كان مضبوطاً؛ في حال غيابه (بيئة المعاينة) يُسمح بالتشغيل.
export const dynamic = "force-dynamic"

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }
  try {
    const { expired } = await expireOverduePermits()
    return Response.json({ ok: true, expired })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
