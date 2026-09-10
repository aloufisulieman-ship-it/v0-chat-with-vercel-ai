import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { saveFrameDetection, touchCameraStream } from "@/app/actions/ai-monitoring"
import { escalateDetection } from "@/app/actions/hse"
import {
  detectionTypeOptions,
  detectionTypeDescriptions,
  detectionClassByType,
  severityByClass,
  type DetectionType,
  type DetectionClass,
} from "@/lib/ai-monitoring"

export const runtime = "nodejs"
export const maxDuration = 60

const TYPE_VALUES = detectionTypeOptions.map((t) => t.value) as [DetectionType, ...DetectionType[]]
// نضمّ "none" لتمكين النموذج من رفض المشهد الغامض بدل التخمين.
const TYPE_VALUES_WITH_NONE = [...TYPE_VALUES, "none"] as [string, ...string[]]

// مخطط الإخراج: قائمة بالاكتشافات في الإطار (قد تكون فارغة). الثقة كسر 0.0-1.0.
// الخطورة تُشتق لاحقاً من التصنيف (لا يحدّدها النموذج) لضمان اتساق المواصفة.
const schema = z.object({
  detections: z
    .array(
      z.object({
        detection_class: z
          .enum(["event", "hazard", "compliance", "none"])
          .describe("تصنيف الكشف: event حدث وقع فعلاً | hazard ظرف خطر | compliance مخالفة PPE | none غامض"),
        detection_type: z.enum(TYPE_VALUES_WITH_NONE).describe("نوع الكشف المحدد، أو none إذا كان المشهد غامضاً"),
        confidence: z.number().min(0).max(1).describe("نسبة الثقة في الكشف من 0.0 إلى 1.0"),
        evidence: z
          .array(z.string())
          .describe("الدلائل المرئية المحددة المرصودة في الصورة (إلزامية لتصنيف حدث)"),
        reasoning_ar: z.string().describe("تعليل موجز بالعربية يشرح سبب هذا التصنيف"),
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

// دليل الأنواع مجمّعاً حسب التصنيف ليعرف النموذج ما يبحث عنه في كل مسار.
const classLabel: Record<DetectionClass, string> = {
  event: "أحداث (event) — وقوع فعلي، حرجة",
  hazard: "مخاطر (hazard) — ظرف خطر محتمل دون وقوع حدث",
  compliance: "التزام (compliance) — مخالفات معدات الوقاية الشخصية",
}
const typeGuide = (["event", "hazard", "compliance"] as const)
  .map((klass) => {
    const lines = detectionTypeOptions
      .filter((t) => detectionClassByType[t.value] === klass)
      .map((t) => `  - ${t.value} (${t.label}): ${detectionTypeDescriptions[t.value as DetectionType]}`)
      .join("\n")
    return `${classLabel[klass]}:\n${lines}`
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
        "حلّل الصورة القادمة من كاميرا مراقبة وصنّف ما تراه إلى الأنواع التالية مجمّعة حسب التصنيف:\n\n" +
        typeGuide +
        "\n\n=== التمييز الحاسم بين «حدث» و«خطر» ===\n" +
        "• «حدث سقوط» (person_fall): شخص فقد اتزانه فعلاً، أو ملامس للأرض، أو في منتصف السقوط. حدث وقع.\n" +
        "• «خطر سقوط» (fall_risk_height): شخص واقف على سطح مرتفع أو حافة مركبة/شاحنة أو سلّم بدون حماية، " +
        "لكنه متزن ويؤدي عمله بشكل طبيعي. هذا خطر محتمل وليس حادثاً.\n\n" +
        "=== قواعد صارمة ===\n" +
        "1) لا تُصنّف كشفاً على أنه detection_class = 'event' إلا إذا ذكرت دليلاً مرئياً مباشراً على وقوع الحدث في حقل evidence " +
        "(مثل: «الشخص ملامس للأرض»، «الحمولة متناثرة على الأرضية»، «ألسنة لهب مرئية»). إذا لم يوجد دليل مباشر فأعد " +
        "detection_class = 'hazard' أو 'none'.\n" +
        "2) الأمثلة السلبية التالية عملٌ اعتيادي ولا تُصنّف أحداثاً إطلاقاً: تفريغ أو تحميل بضائع من شاحنة (مبردة أو غيرها)، " +
        "عامل ينحني لرفع صندوق، عامل يصعد أو ينزل سلّم الشاحنة، عامل جالس أو راكع، عامل يمدّ يده للبضاعة. " +
        "لا تُفسّر أياً منها على أنه سقوط شخص.\n" +
        "3) إذا كان المشهد غامضاً أو غير مؤكد فأعد detection_type = 'none' بدل التخمين.\n" +
        "4) اذكر في evidence الدلائل المرئية المحددة التي رأيتها فقط، وفي reasoning_ar تعليلاً موجزاً. " +
        "التزم بنسبة ثقة واقعية بين 0.0 و1.0 ولا تبالغ.\n" +
        "أعد قائمة بالاكتشافات المرصودة فقط، وقائمة فارغة إذا لم تلاحظ أي شيء ذي دلالة.",
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
    const frameDetections = object.detections
      // نستبعد المشاهد الغامضة ("none") — لا تُحفظ ولا تُعرض.
      .filter((d) => d.detection_type !== "none")
      .map((d) => {
        let type = d.detection_type as DetectionType
        let klass = detectionClassByType[type] ?? (d.detection_class as DetectionClass)
        const evidence = Array.isArray(d.evidence) ? d.evidence.map((e) => e.trim()).filter(Boolean) : []
        // حماية خادمية: لا يُعتمد «حدث» بلا دليل مرئي مباشر — يُخفَّض إلى «خطر»،
        // وسقوط الشخص بلا دليل يُعاد تصنيفه إلى «خطر سقوط من ارتفاع».
        if (klass === "event" && evidence.length === 0) {
          if (type === "person_fall") type = "fall_risk_height"
          klass = detectionClassByType[type] === "event" ? "hazard" : detectionClassByType[type]
        }
        const parts = [d.reasoning_ar?.trim()].filter(Boolean) as string[]
        if (d.location_hint?.trim()) parts.push(`الموقع: ${d.location_hint.trim()}`)
        if (typeof d.persons_involved === "number" && d.persons_involved > 0)
          parts.push(`أشخاص متورطون: ${d.persons_involved}`)
        return {
          type,
          // الخطورة الرسمية تُشتق من التصنيف لا من النموذج.
          severity: severityByClass[klass],
          confidence: Math.round(d.confidence <= 1 ? d.confidence * 100 : d.confidence),
          description: parts.join(" — "),
          evidence,
          reasoning: d.reasoning_ar?.trim() || "",
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

    // التصعيد التلقائي مقصور على «الأحداث» (event) المعتمدة فقط: تُحفظ بالحالة "new"
    // عندما تكون الثقة ≥ 85% (انظر saveFrameDetection)، فتُصعَّد فوراً إلى حادث. أما
    // «المخاطر» و«الالتزام» فلا تُصعَّد آلياً أبداً ولا يُنشأ منها حادث. escalateDetection
    // متعادِلة فلا تُكرّر التصعيد، وفشلها لا يُفشل حفظ الكشف.
    const klass = detectionClassByType[row.detectionType as DetectionType] ?? "compliance"
    if (row.status === "new" && klass === "event") {
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
