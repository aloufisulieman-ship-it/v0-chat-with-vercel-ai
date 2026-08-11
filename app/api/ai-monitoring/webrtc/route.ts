import { type NextRequest, NextResponse } from "next/server"
import { and, asc, eq, gt, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import { webrtcSignal } from "@/lib/db/schema"
import { requireUser, requireHseReviewerId } from "@/lib/session"
import { sessionCameraId } from "@/lib/camera-session"

// قناة إشارات WebRTC عبر قاعدة البيانات.
//
// الأدوار:
//   - "camera"  = صفحة كاميرا المفتش (المُرسِل). هويتها = حسابها + اسم المفتش،
//                 ومنها نشتقّ cameraId في الخادم فلا يحتاج العميل لمعرفته.
//   - "viewer"  = المدير المُشاهد (مقصور على مراجعي HSE). يمرّر cameraId الهدف.
//
// POST: إرسال إشارة (offer/answer/ice).
// GET : استقصاء الإشارات الجديدة القادمة من الطرف الآخر (id > after).

export const dynamic = "force-dynamic"

// حذف الإشارات الأقدم من دقيقتين لجلسة الكاميرا (تنظيف تلقائي خفيف).
async function pruneOld(cameraId: string) {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000)
  await db.delete(webrtcSignal).where(and(eq(webrtcSignal.cameraId, cameraId), lt(webrtcSignal.createdAt, cutoff)))
}

// اشتقاق cameraId حسب الدور مع فرض الصلاحيات المناسبة.
async function resolveCameraId(role: string, params: { cameraId?: string; inspectorName?: string }): Promise<string> {
  if (role === "camera") {
    // المُرسِل: أي مستخدم مسجّل دخول؛ المعرّف يُشتقّ من حسابه + اسم المفتش.
    const userId = (await requireUser()).id
    return sessionCameraId(userId, params.inspectorName || "")
  }
  // المُشاهد: مقصور على المدير/المراجع، ويمرّر معرّف الكاميرا الهدف مباشرةً.
  await requireHseReviewerId()
  return (params.cameraId || "").trim()
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
      return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 })
    }
    const cameraId = await resolveCameraId(role, { cameraId: body.cameraId, inspectorName: body.inspectorName })
    if (!cameraId) return NextResponse.json({ error: "معرّف كاميرا مفقود" }, { status: 400 })

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
    const msg = err instanceof Error ? err.message : "خطأ"
    return NextResponse.json({ error: msg }, { status: 403 })
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

    const rows = await db
      .select()
      .from(webrtcSignal)
      .where(where)
      .orderBy(asc(webrtcSignal.id))
      .limit(50)

    const signals = rows.map((r) => ({
      id: r.id,
      viewerSessionId: r.viewerSessionId,
      kind: r.kind,
      payload: safeParse(r.payload),
    }))

    return NextResponse.json({ signals, cameraId })
  } catch {
    return NextResponse.json({ signals: [], cameraId: "" }, { status: 200 })
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
