import { type NextRequest, NextResponse } from "next/server"
import { and, asc, eq, gt, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import { webrtcSignal, activeCameraStream } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { hasModuleAccess } from "@/lib/permissions"
import { sessionCameraId } from "@/lib/camera-session"

// قناة إشارات WebRTC عبر قاعدة البيانات (لا تستخدم LiveKit ولا أي خدمة خارجية).
//
// الأدوار:
//   - "camera"  = صفحة كاميرا المفتش (المُرسِل). هويتها = حسابها + اسم المفتش،
//                 ومنها نشتقّ cameraId في الخادم فلا يحتاج العميل لمعرفته.
//   - "viewer"  = المدير المُشاهد (مقصور على مراجعي HSE). يمرّر cameraId الهدف.
//
// POST: إرسال إشارة (offer/answer/ice).
// GET : استقصاء الإشارات الجديدة القادمة من الطرف الآخر (id > after).

export const dynamic = "force-dynamic"

// خطأ صلاحيات صريح يحمل رمز الحالة المناسب (401 غير مسجّل، 403 ممنوع).
class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// حذف الإشارات الأقدم من دقيقتين لجلسة الكاميرا (تنظيف تلقائي خفيف).
async function pruneOld(cameraId: string) {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000)
  await db.delete(webrtcSignal).where(and(eq(webrtcSignal.cameraId, cameraId), lt(webrtcSignal.createdAt, cutoff)))
}

// اشتقاق cameraId حسب الدور مع فرض الصلاحيات المناسبة.
// نستخدم getCurrentUser (بلا توجيه) بدل requireUser حتى لا يرمي redirect استثناءً
// يظهر خطأً مبهماً؛ وبدلاً من ذلك نُرجع رسالة ورمز حالة واضحين.
async function resolveCameraId(role: string, params: { cameraId?: string; inspectorName?: string }): Promise<string> {
  const user = await getCurrentUser()
  if (!user) {
    throw new AuthError("يجب تسجيل الدخول للوصول إلى قناة البث المباشر.", 401)
  }
  if (user.status !== "approved") {
    throw new AuthError("حسابك قيد الاعتماد بعد؛ لا يمكن بدء البث المباشر.", 403)
  }

  if (role === "camera") {
    // المُرسِل: أي مستخدم معتمد؛ المعرّف يُشتقّ من حسابه + اسم المفتش.
    return sessionCameraId(user.id, params.inspectorName || "")
  }

  // المُشاهد: مقصور على من يملك صلاحية المراقبة الذكية (admin/manager تلقائياً، أو أي
  // مستخدم مُنح وحدة ai_monitoring صراحةً)، ويمرّر معرّف الكاميرا الهدف مباشرةً.
  if (!hasModuleAccess(user.role, user.permissions, "ai_monitoring")) {
    throw new AuthError("مشاهدة البث المباشر مقصورة على من يملك صلاحية المراقبة الذكية.", 403)
  }
  const targetCameraId = (params.cameraId || "").trim()
  if (!targetCameraId) return ""

  // عزل بين المؤسسات: لا يشاهد المراجع إلا كاميرا مسجّلة كبثّ نشط ضمن مؤسسته.
  // (cameraId تجزئة غير تشفيرية 32-بت قابلة للتخمين نظرياً، فنتحقق من الانتماء صراحةً
  // بدل الوثوق بالمعرّف الممرّر.)
  const owned = await db
    .select({ id: activeCameraStream.id })
    .from(activeCameraStream)
    .where(
      and(
        eq(activeCameraStream.cameraId, targetCameraId),
        eq(activeCameraStream.organizationId, user.organizationId),
      ),
    )
    .limit(1)
  if (!owned[0]) {
    throw new AuthError("هذه الكاميرا لا تتبع مؤسستك.", 403)
  }
  return targetCameraId
}

// تحويل أي خطأ إلى استجابة JSON واضحة (مع تسجيل التفاصيل الكاملة في السجل).
function errorResponse(err: unknown, context: string) {
  if (err instanceof AuthError) {
    // أخطاء الصلاحيات متوقّعة؛ تُرجع رمزها ورسالتها دون ضجيج في السجل.
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  const message = err instanceof Error ? err.message : String(err)
  console.log(`[v0] webrtc ${context} error:`, message)
  return NextResponse.json({ error: `تعذّر تنفيذ الطلب: ${message}` }, { status: 500 })
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      role?: string
      viewerSessionId?: string
      kind?: string
      payload?: unknown
      cameraId?: string
      inspectorName?: string
    }
    const role = body.role === "camera" ? "camera" : "viewer"
    const viewerSessionId = (body.viewerSessionId || "").slice(0, 80)
    const kind = body.kind || ""
    if (!viewerSessionId || !["offer", "answer", "ice"].includes(kind)) {
      return NextResponse.json({ error: "طلب غير صالح (viewerSessionId أو kind مفقود)." }, { status: 400 })
    }
    const cameraId = await resolveCameraId(role, { cameraId: body.cameraId, inspectorName: body.inspectorName })
    if (!cameraId) return NextResponse.json({ error: "معرّف الكاميرا مفقود." }, { status: 400 })

    await db.insert(webrtcSignal).values({
      cameraId,
      viewerSessionId,
      sender: role,
      kind,
      payload: JSON.stringify(body.payload ?? null),
    })
    // تنظيف انتهازي بدون انتظار.
    void pruneOld(cameraId)

    return NextResponse.json({ ok: true, cameraId })
  } catch (err) {
    return errorResponse(err, "POST")
  }
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const role = sp.get("role") === "camera" ? "camera" : "viewer"
    const after = Number(sp.get("after") || "0") || 0
    const viewerSessionId = sp.get("viewerSessionId") || ""

    const cameraId = await resolveCameraId(role, {
      cameraId: sp.get("cameraId") || undefined,
      inspectorName: sp.get("inspectorName") || undefined,
    })
    if (!cameraId) return NextResponse.json({ signals: [], cameraId: "" })

    // كل طرف يقرأ إشارات الطرف الآخر فقط.
    const otherSender = role === "camera" ? "viewer" : "camera"

    // المُشاهد يقيّد بجلسته؛ الكاميرا تقرأ عروض كل المشاهدين لاكتشاف جلسات جديدة.
    const where =
      role === "viewer"
        ? and(
            eq(webrtcSignal.cameraId, cameraId),
            eq(webrtcSignal.viewerSessionId, viewerSessionId),
            eq(webrtcSignal.sender, otherSender),
            gt(webrtcSignal.id, after),
          )
        : and(eq(webrtcSignal.cameraId, cameraId), eq(webrtcSignal.sender, otherSender), gt(webrtcSignal.id, after))

    const rows = await db.select().from(webrtcSignal).where(where).orderBy(asc(webrtcSignal.id)).limit(50)

    const signals = rows.map((r) => ({
      id: r.id,
      viewerSessionId: r.viewerSessionId,
      kind: r.kind,
      payload: safeParse(r.payload),
    }))

    return NextResponse.json({ signals, cameraId })
  } catch (err) {
    return errorResponse(err, "GET")
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
