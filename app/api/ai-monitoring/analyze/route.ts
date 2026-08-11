import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { saveDetection, touchCameraStream } from "@/app/actions/ai-monitoring"
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
      cameraId?: string
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
      messages: [
        {
          role: "system",
          content:
            "أنت نظام رؤية حاسوبية متخصص في مراقبة السلامة داخل ساحات الرافعات الشوكية والمستودعات. " +
            "حلّل الصورة القادمة من كاميرا مراقبة وارصد فقط المخالفات الواضحة من الأنواع التالية:\n" +
            typeGuide +
            "\n\nأعد قائمة بالمخالفات المرصودة فقط. إذا لم تلاحظ أي مخالفة واضحة أعد قائمة فارغة. " +
            "لا تخترع مخالفات غير مؤكدة، والتزم بنسبة ثقة واقعية.",
        },
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

    const cameraId = (body.cameraId || "").toString()
    const cameraLocation = (body.cameraLocation || "").toString()

    // تحديث نبضة الاتصال فقط (بدون تمرير إطار) حتى لا نمحو رابط Blob الأحدث
    // الذي يرفعه مسار upload-frame كل 1-2 ثانية.
    await touchCameraStream({ cameraId, cameraLocation })

    // حفظ كل مخالفة مكتشفة كسجل مستقل مع لقطة الإثبات.
    const saved = []
    for (const d of object.detections) {
      // بعض النماذج تُعيد الثقة ككسر (0-1) بدل نسبة مئوية؛ نُوحّدها إلى 0-100.
      const confidenceScore = Math.round(d.confidence <= 1 ? d.confidence * 100 : d.confidence)
      const row = await saveDetection({
        cameraId,
        cameraLocation,
        detectionType: d.type,
        severity: d.severity,
        confidenceScore,
        snapshotUrl: image,
        notes: d.description,
      })
      saved.push({
        id: row.id,
        detectionId: row.detectionId,
        type: row.detectionType,
        severity: row.severity,
        confidence: row.confidenceScore,
        description: row.notes,
      })
    }

    return NextResponse.json({ count: saved.length, detections: saved })
  } catch (err) {
    console.log("[v0] analyze route error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: "تعذّر تحليل الصورة" }, { status: 500 })
  }
}
