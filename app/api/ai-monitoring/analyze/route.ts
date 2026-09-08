import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { saveFrameDetection, touchCameraStream } from "@/app/actions/ai-monitoring"
import { escalateDetection } from "@/app/actions/hse"
import {
  detectionTypeOptions,
  detectionTypeDescriptions,
  detectionCategoryByType,
  type DetectionType,
} from "@/lib/ai-monitoring"

export const runtime = "nodejs"
export const maxDuration = 60

const TYPE_VALUES = detectionTypeOptions.map((t) => t.value) as [DetectionType, ...DetectionType[]]

// مخطط الإخراج: قائمة بالاكتشافات في الإطار (قد تكون فارغة). الثقة كسر 0.0-1.0.
const schema = z.object({
  detections: z
    .array(
      z.object({
        type: z.enum(TYPE_VALUES).describe("نوع الاكتشاف (سلوكي أو حادث أو بيئي)"),
        confidence: z.number().min(0).max(1).describe("نسبة الثقة في الاكتشاف من 0.0 إلى 1.0"),
        severity: z.enum(["low", "medium", "high", "critical"]).describe("درجة الخطورة"),
        description_ar: z.string().describe("وصف موجز جداً للاكتشاف بالعربية"),
        location_hint: z.string().optional().describe("تلميح لموقع الحدث داخل الإطار (اختياري)"),
        persons_involved: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("عدد الأشخاص المتورطين إن وُجدوا (اختياري)"),
      }),
    )
    .describe("قائمة الاكتشافات في الصورة، فارغة إذا لم يُرصد أي شيء"),
})

// دليل الأنواع مجمّعاً حسب الفئة ليعرف النموذج ما يبحث عنه في كل مسار.
const catLabel: Record<string, string> = {
  behavioral: "مخالفات سلوكية",
  incident: "حوادث",
  environmental: "مخاطر بيئية",
}
const typeGuide = (["behavioral", "incident", "environmental"] as const)
  .map((cat) => {
    const lines = detectionTypeOptions
      .filter((t) => detectionCategoryByType[t.value] === cat)
      .map((t) => `  - ${t.value} (${t.label}): ${detectionTypeDescriptions[t.value as DetectionType]}`)
      .join("\n")
    return `${catLabel[cat]}:\n${lines}`
  })
  .join("\n\n")

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      image?: string
      inspectorName?: string
      cameraLocation?: string
    }

    const image = body.image
    if (!image || typeof image !== "string" || !image.startsWith("data:image")) {
      return NextResponse.json({ error: "صورة غير صالحة" }, { status: 400 })
    }

    // استخراج نوع الوسائط من ترويسة data URL (نمرّر رابط data URL كاملاً للنموذج).
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,.+$/.exec(image)
    if (!match) {
      return NextResponse.json({ error: "تنسيق صورة غير مدعوم" }, { status: 400 })
    }
    const mediaType = match[1]

    const { object } = await generateObject({
      model: "anthropic/claude-sonnet-4.6",
      schema,
      // AI SDK v7: لا يُسمح برسالة بدور "system" داخل messages؛ نمرّر التوجيه عبر
      // المعامل العلوي system وإلا يُرمى AI_InvalidPromptError ويفشل كل تحليل.
      system:
        "أنت نظام رؤية حاسوبية متخصص في مراقبة السلامة (وفق ISO 45001) داخل ساحات الرافعات الشوكية والمستودعات. " +
        "حلّل الصورة القادمة من كاميرا مراقبة وارصد فقط الأحداث الواضحة من الأنواع التالية:\n\n" +
        typeGuide +
        "\n\nأعد قائمة بالاكتشافات المرصودة فقط. إذا لم تلاحظ أي حدث واضح أعد قائمة فارغة. " +
        "أعطِ الأولوية لكشف الحوادث الخطيرة (اصطدام، سقوط شخص أو حمولة، دخان/حريق) والحوادث الوشيكة. " +
        "لا تخترع أحداثاً غير مؤكدة، والتزم بنسبة ثقة واقعية بين 0.0 و1.0.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "حلّل هذا الإطار من كاميرا الساحة وحدّد أي مخالفات سلامة." },
            // AI SDK v5+: نوع "image" مهمل؛ نستخدم جزء "file" مع رابط data URL.
            { type: "file", data: image, mediaType },
          ],
        },
      ],
    })

    const inspectorName = (body.inspectorName || "").toString()
    const cameraLocation = (body.cameraLocation || "").toString()

    // تحديث نبضة الاتصال فقط (بدون تمرير إطار) حتى لا نمحو رابط Blob الأحدث
    // الذي يرفعه مسار upload-frame كل 1-2 ثانية.
    await touchCameraStream({ inspectorName, cameraLocation })

    // دمج كل اكتشافات الإطار الواحد في سجل واحد بنفس اللقطة (بدل صف لكل اكتشاف).
    // الثقة تأتي ككسر 0.0-1.0؛ نُوحّدها إلى 0-100. نُضمّن تلميح الموقع وعدد
    // الأشخاص المتورطين في الوصف لتغذية سجلّ الحادث المُصعَّد لاحقاً.
    const frameDetections = object.detections.map((d) => {
      const parts = [d.description_ar?.trim()].filter(Boolean) as string[]
      if (d.location_hint?.trim()) parts.push(`الموقع: ${d.location_hint.trim()}`)
      if (typeof d.persons_involved === "number" && d.persons_involved > 0)
        parts.push(`أشخاص متورطون: ${d.persons_involved}`)
      return {
        type: d.type,
        severity: d.severity,
        confidence: Math.round(d.confidence <= 1 ? d.confidence * 100 : d.confidence),
        description: parts.join(" — "),
      }
    })

    const row = await saveFrameDetection({
      inspectorName,
      cameraLocation,
      snapshotUrl: image,
      detections: frameDetections,
    })

    if (!row) {
      // لم تُرصد أي مخالفة في هذا الإطار.
      return NextResponse.json({ count: 0, detections: [] })
    }

    // التصعيد التلقائي: كشوفات الحوادث/البيئية المعتمدة (ثقة ≥ 70% → الحالة "new")
    // تُصعَّد فوراً إلى حادث/حادث وشيك/إجراء تصحيحي. الأنواع السلوكية تبقى على مسار
    // المخالفات اليدوي. escalateDetection متعادِلة (idempotent) فلا تُكرّر التصعيد
    // مع الإطارات المتتالية لنفس الحدث المستمر. فشل التصعيد لا يُفشل حفظ الكشف.
    const category = detectionCategoryByType[row.detectionType as DetectionType] ?? "behavioral"
    if (row.status === "new" && (category === "incident" || category === "environmental")) {
      try {
        await escalateDetection(row.id)
      } catch (e) {
        console.log("[v0] auto-escalate failed:", e instanceof Error ? e.message : String(e))
      }
    }

    // نُعيد عناصر العرض (نوعاً لكل مخالفة مرصودة) للوحة كاميرا الهاتف، مع كون
    // جميعها مرتبطة بالسجل/اللقطة الواحدة نفسها.
    const detections = frameDetections.map((d) => ({
      id: row.id,
      detectionId: row.detectionId,
      type: d.type,
      severity: d.severity,
      confidence: d.confidence,
      description: d.description,
    }))

    return NextResponse.json({ count: detections.length, detections })
  } catch (err) {
    console.log("[v0] analyze route error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: "تعذّر تحليل الصورة" }, { status: 500 })
  }
}
