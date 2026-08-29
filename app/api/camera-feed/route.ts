import { NextResponse } from "next/server"
import { autoGateRead, recordExternalFrame } from "@/app/actions/vehicle-tracking"

export const runtime = "nodejs"
export const maxDuration = 60

// عتبة الثقة الدنيا لقبول القراءة تلقائياً (مطابقة لعتبة الوضع التلقائي في الواجهة).
const AUTO_CONFIDENCE_MIN = 55

/**
 * POST /api/camera-feed
 * مدخل عام لاستقبال فريمات كاميرات البوابات من أي مصدر خارجي (خادم جسر مرتبط بكاميرات
 * NVR الحقيقية لاحقاً) عبر HTTP. يستقبل: صورة (data URL) + gate_id + timestamp.
 *
 * لا يحتوي هذا المسار أي منطق تعرّف أو تسجيل جديد: يمرّر الفريم إلى نفس مسار التعرّف
 * الحالي (/api/ai-monitoring/recognize بوضع اللوحات) ثم إلى نفس دالة autoGateRead
 * المستخدمة في الوضع التلقائي — تماماً كما تفعل كاميرا الجهاز في المتصفح.
 *
 * المصادقة: يجب أن يمرّر المصدر الخارجي كوكي جلسة صالحة (تُمرَّر كما هي إلى مسار
 * التعرّف)، فيُحلّ سياق المؤسسة والصلاحيات عبر نفس آلية الجلسة القائمة دون تغيير.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { image?: string; gate_id?: unknown; gateId?: unknown; timestamp?: unknown }
      | null
    if (!body) {
      return NextResponse.json({ ok: false, error: "جسم الطلب غير صالح" }, { status: 400 })
    }

    const image = typeof body.image === "string" ? body.image : ""
    if (!image.startsWith("data:image")) {
      return NextResponse.json({ ok: false, error: "صورة غير صالحة (يُتوقّع data URL)" }, { status: 400 })
    }

    const gateRaw = body.gate_id ?? body.gateId
    const gateId = Math.trunc(Number(gateRaw))
    if (!Number.isFinite(gateId) || gateId < 1) {
      return NextResponse.json({ ok: false, error: "gate_id مطلوب ورقم صحيح" }, { status: 400 })
    }

    // تمرير الفريم إلى مسار التعرّف الحالي دون أي تعديل في منطق القراءة، مع إعادة توجيه
    // كوكي الجلسة الواردة حتى يُحلّ سياق المؤسسة كما في نداء الكاميرا من المتصفح.
    const origin = new URL(req.url).origin
    const recognizeRes = await fetch(`${origin}/api/ai-monitoring/recognize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        image,
        inspectorName: `بوابة خارجية ${gateId}`,
        cameraLocation: `بوابة ${gateId}`,
        modes: ["plate"],
      }),
    })

    if (!recognizeRes.ok) {
      const status = recognizeRes.status === 401 || recognizeRes.status === 403 ? recognizeRes.status : 502
      return NextResponse.json({ ok: false, error: "تعذّر تحليل الفريم عبر مسار التعرّف" }, { status })
    }

    const recognized = (await recognizeRes.json().catch(() => null)) as
      | { plate?: { value?: string; confidence?: number } }
      | null
    const plate = recognized?.plate?.value?.trim() ?? ""
    const confidence = recognized?.plate?.confidence ?? 0

    // تسجيل آخر نشاط للبث الخارجي لهذه البوابة (لعرض حالته في الواجهة) — لا يؤثّر على المنطق.
    try {
      await recordExternalFrame(gateId, plate)
    } catch {
      /* لا يوقف فشل تحديث حالة البث بقية المعالجة */
    }

    if (!plate) {
      return NextResponse.json({ ok: true, plate: null, action: "none", message: "لم تُقرأ لوحة في هذا الفريم" })
    }
    if (confidence < AUTO_CONFIDENCE_MIN) {
      return NextResponse.json({
        ok: true,
        plate,
        confidence,
        action: "low_confidence",
        message: "ثقة القراءة أقل من العتبة — تم التجاهل",
      })
    }

    // نفس دالة الوضع التلقائي: دخول إن كانت خارج السوق، أو مشاهدة إن كانت داخله.
    const outcome = await autoGateRead(plate, gateId)
    return NextResponse.json({ confidence, ...outcome })
  } catch (err) {
    console.log("[v0] camera-feed error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ ok: false, error: "خطأ غير متوقّع في استقبال الفريم" }, { status: 500 })
  }
}
