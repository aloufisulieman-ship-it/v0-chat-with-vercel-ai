import { NextResponse } from "next/server"
import { createObservationFull } from "@/app/actions/hse"

// نقطة ربط الجولة بسجل الملاحظات والإيجابيات: تستقبل بيانات الملاحظة المسجّلة
// أثناء الجولة كـ JSON، وتبنيها كـ FormData ثم تمررها لدالة createObservationFull
// ليُحفظ السجل ويظهر في لوحة التحكم والتقارير مع رقمه الرسمي (OBS/POS-YYYY-XXX).
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const description = String(body.description ?? "").trim()
    if (!description) {
      return NextResponse.json({ error: "وصف الملاحظة مطلوب" }, { status: 400 })
    }

    const kind = String(body.kind ?? "observation") === "positive" ? "positive" : "observation"

    const fd = new FormData()
    fd.set("kind", kind)
    fd.set("description", description)
    fd.set("location", String(body.location ?? ""))
    fd.set("observedBy", String(body.observedBy ?? ""))
    fd.set("observationDate", String(body.observationDate ?? ""))
    fd.set("observationTime", String(body.observationTime ?? ""))
    fd.set("patrolId", String(body.patrolId ?? ""))
    fd.set("status", String(body.status || "open"))
    fd.set("images", JSON.stringify(Array.isArray(body.images) ? body.images : []))

    const result = await createObservationFull(fd)
    return NextResponse.json({ documentNo: result.documentNo })
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذّر حفظ الملاحظة"
    const status = message.includes("صلاحية") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
