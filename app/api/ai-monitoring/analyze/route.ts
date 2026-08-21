import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { saveFrameDetection, touchCameraStream } from "@/app/actions/ai-monitoring"
import {
  detectionTypeOptions,
  detectionTypeDescriptions,
  type DetectionType,
} from "@/lib/ai-monitoring"

export const runtime = "nodejs"
export const maxDuration = 60

const TYPE_VALUES = detectionTypeOptions.map((t) => t.value) as [DetectionType, ...DetectionType[]]

// مخطط الإخراج: قائمة بالمخالفات المكتشفة في الإطار (قد تكون فارغة).
const schema = z.object({
  detections: z
    .array(
      z.object({
        type: z.enum(TYPE_VALUES).describe("نوع المخالفة المكتشفة"),
        severity: z.enum(["low", "medium", "high", "critical"]).describe("درجة خطورة المخالفة"),
        confidence: z.number().min(0).max(100).describe("نسبة الثقة في الاكتشاف من 0 إلى 100"),
        description: z.string().describe("وصف موجز جداً للمخالفة بالعربية"),
      }),
    )
    .describe("قائمة المخالفات المكتشفة في الصورة، فارغة إذا لم تُرصد أي مخالفة"),
})

const typeGuide = detectionTypeOptions
  .map((t) => `- ${t.value} (${t.label}): ${detectionTypeDescriptions[t.value as DetectionType]}`)
  .join("\n")

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
        "أنت نظام رؤية حاسوبية متخصص في مراقبة السلامة داخل ساحات الرافعات الشوكية والمستودعات. " +
        "حلّل الصورة القادمة من كاميرا مراقبة وارصد فقط المخالفات الواضحة من الأنواع التالية:\n" +
        typeGuide +
        "\n\nأعد قائمة بالمخالفات المرصودة فقط. إذا لم تلاحظ أي مخالفة واضحة أعد قائمة فارغة. " +
        "لا تخترع مخالفات غير مؤكدة، والتزم بنسبة ثقة واقعية.",
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

    // دمج كل مخالفات الإطار الواحد في سجل واحد بنفس اللقطة (بدل صف لكل مخالفة).
    // بعض النماذج تُعيد الثقة ككسر (0-1) بدل نسبة مئوية؛ نُوحّدها إلى 0-100.
    const frameDetections = object.detections.map((d) => ({
      type: d.type,
      severity: d.severity,
      confidence: Math.round(d.confidence <= 1 ? d.confidence * 100 : d.confidence),
      description: d.description,
    }))

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
