import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { db } from "@/lib/db"
import { aiDetection } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/session"
import { saveFrameDetection, touchCameraStream } from "@/app/actions/ai-monitoring"
import {
  savePlateRead,
  saveEmployeeIdRead,
  saveTuktukRead,
  createExpiredPermitAlert,
} from "@/app/actions/ai-recognition"
import {
  detectionTypeOptions,
  detectionTypeDescriptions,
  type DetectionType,
} from "@/lib/ai-monitoring"
import {
  isRecognitionMode,
  normalizeConfidence,
  HIGH_CONFIDENCE,
  MIN_STORE_CONFIDENCE,
  type RecognitionMode,
} from "@/lib/ai-recognition"

export const runtime = "nodejs"
export const maxDuration = 60

const TYPE_VALUES = detectionTypeOptions.map((t) => t.value) as [DetectionType, ...DetectionType[]]

const typeGuide = detectionTypeOptions
  .map((t) => `- ${t.value} (${t.label}): ${detectionTypeDescriptions[t.value as DetectionType]}`)
  .join("\n")

// أجزاء المخطط لكل وضع تعرّف — تُركّب ديناميكياً حسب الأوضاع المطلوبة فقط.
const violationsPart = z
  .array(
    z.object({
      type: z.enum(TYPE_VALUES).describe("نوع المخالفة المكتشفة"),
      severity: z.enum(["low", "medium", "high", "critical"]).describe("درجة الخطورة"),
      confidence: z.number().min(0).max(100).describe("نسبة الثقة 0-100"),
      description: z.string().describe("وصف موجز جداً بالعربية"),
    }),
  )
  .describe("قائمة المخالفات المرصودة، فارغة إذا لم تُرصد أي مخالفة")

const platePart = z
  .object({
    plateNumber: z.string().describe("رقم اللوحة كاملاً كما يظهر (أرقام + رمز حرفي عربي إن وُجد)"),
    confidence: z.number().min(0).max(100).describe("نسبة الثقة 0-100"),
  })
  .nullable()
  .describe("لوحة مركبة واضحة في الإطار، أو null إذا لم تظهر لوحة قابلة للقراءة")

const employeePart = z
  .object({
    employeeNumber: z.string().describe("الرقم الوظيفي المطبوع/المطرّز على زيّ العامل من الخلف"),
    confidence: z.number().min(0).max(100).describe("نسبة الثقة 0-100"),
  })
  .nullable()
  .describe("رقم وظيفي واضح على ظهر عامل، أو null إذا لم يظهر")

const tuktukPart = z
  .object({
    tuktukNumber: z.string().describe("رقم مركبة التوك توك المطبوع على الهيكل (رقمي غالباً)"),
    confidence: z.number().min(0).max(100).describe("نسبة الثقة 0-100"),
  })
  .nullable()
  .describe("رقم توك توك واضح على الهيكل، أو null إذا لم يظهر")

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      image?: string
      inspectorName?: string
      cameraLocation?: string
      modes?: unknown
    }

    const image = body.image
    if (!image || typeof image !== "string" || !image.startsWith("data:image")) {
      return NextResponse.json({ error: "صورة غير صالحة" }, { status: 400 })
    }
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,.+$/.exec(image)
    if (!match) {
      return NextResponse.json({ error: "تنسيق صورة غير مدعوم" }, { status: 400 })
    }
    const mediaType = match[1]

    // الأوضاع المطلوبة (يجب أن يكون واحداً على الأقل صالحاً).
    const modes: RecognitionMode[] = Array.isArray(body.modes)
      ? [...new Set(body.modes.filter(isRecognitionMode))]
      : []
    if (modes.length === 0) {
      return NextResponse.json({ error: "لم يُحدَّد أي وضع تعرّف" }, { status: 400 })
    }

    // بناء المخطط والتوجيه ديناميكياً حسب الأوضاع المطلوبة.
    const shape: Record<string, z.ZodTypeAny> = {}
    const instructions: string[] = []
    if (modes.includes("violations")) {
      shape.detections = violationsPart
      instructions.push("• المخالفات: ارصد فقط المخالفات الواضحة من الأنواع التالية:\n" + typeGuide)
    }
    if (modes.includes("plate")) {
      shape.plate = platePart
      instructions.push("• اللوحات: اقرأ رقم لوحة المركبة الظاهرة (نمط عُماني: أرقام + رمز حرفي عربي).")
    }
    if (modes.includes("employee_id")) {
      shape.employeeId = employeePart
      instructions.push("• الرقم الوظيفي: اقرأ الرقم الوظيفي المطبوع/المطرّز على ظهر زيّ العامل.")
    }
    if (modes.includes("tuktuk")) {
      shape.tuktuk = tuktukPart
      instructions.push("• رقم التوك توك: اقرأ رقم مركبة التوك توك المطبوع على الهيكل.")
    }
    const schema = z.object(shape)

    const { object } = await generateObject({
      model: "anthropic/claude-sonnet-4.6",
      schema,
      system:
        "أنت نظام رؤية حاسوبية لمراقبة السلامة في ساحات الرافعات الشوكية والمستودعات. " +
        "حلّل الإطار القادم من كاميرا مراقبة ونفّذ المهام المطلوبة التالية فقط:\n" +
        instructions.join("\n") +
        "\n\nكن دقيقاً وواقعياً في نسبة الثقة، ولا تخترع قيماً غير مؤكدة. " +
        "أعد null لأي حقل هوية لا يظهر بوضوح، وقائمة فارغة إذا لم تُرصد مخالفات.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "حلّل هذا الإطار من كاميرا الساحة وفق المهام المطلوبة." },
            { type: "file", data: image, mediaType },
          ],
        },
      ],
    })

    const inspectorName = (body.inspectorName || "").toString()
    const cameraLocation = (body.cameraLocation || "").toString()
    const obj = object as Record<string, unknown>

    // تحديث نبضة الاتصال (heartbeat) دون تمرير إطار حتى لا نمحو رابط Blob الأحدث.
    await touchCameraStream({ inspectorName, cameraLocation })

    const result: {
      violations?: { count: number; detections: unknown[]; detectionDbId?: number }
      plate?: { value: string; confidence: number; readId: number }
      employee?: {
        value: string
        confidence: number
        matched: boolean
        name: string
        department: string
        readId: number
      }
      tuktuk?: {
        value: string
        confidence: number
        permitStatus: string
        driverName: string
        documentNo: string
        readId: number
      }
      prefill?: { source: "employee_id" | "tuktuk" | "plate"; employeeName?: string; employeeNo?: string; driverName?: string; vehicleNo?: string }
    } = {}

    // ---- وضع المخالفات ----
    let detectionRowId: number | undefined
    if (modes.includes("violations")) {
      const raw = Array.isArray(obj.detections) ? (obj.detections as Record<string, unknown>[]) : []
      const frameDetections = raw.map((d) => ({
        type: String(d.type) as DetectionType,
        severity: String(d.severity),
        confidence: normalizeConfidence(d.confidence as number),
        description: String(d.description ?? ""),
      }))
      const row = await saveFrameDetection({
        inspectorName,
        cameraLocation,
        snapshotUrl: image,
        detections: frameDetections,
      })
      if (row) {
        detectionRowId = row.id
        result.violations = {
          count: frameDetections.length,
          detectionDbId: row.id,
          detections: frameDetections.map((d) => ({
            id: row.id,
            detectionId: row.detectionId,
            type: d.type,
            severity: d.severity,
            confidence: d.confidence,
            description: d.description,
          })),
        }
      } else {
        result.violations = { count: 0, detections: [] }
      }
    }

    // ---- وضع اللوحات ----
    if (modes.includes("plate") && obj.plate) {
      const p = obj.plate as { plateNumber?: string; confidence?: number }
      const value = (p.plateNumber || "").trim()
      const confidence = normalizeConfidence(p.confidence)
      if (value && confidence >= MIN_STORE_CONFIDENCE) {
        const { id } = await savePlateRead({
          plateNumber: value,
          confidence,
          imageUrl: image,
          cameraName: inspectorName,
          location: cameraLocation,
        })
        result.plate = { value, confidence, readId: id }
      }
    }

    // ---- وضع الرقم الوظيفي ----
    let employeeMatch: { name: string; employeeNo: string } | null = null
    if (modes.includes("employee_id") && obj.employeeId) {
      const e = obj.employeeId as { employeeNumber?: string; confidence?: number }
      const value = (e.employeeNumber || "").trim()
      const confidence = normalizeConfidence(e.confidence)
      if (value && confidence >= MIN_STORE_CONFIDENCE) {
        const { id, match } = await saveEmployeeIdRead({
          employeeNumber: value,
          confidence,
          imageUrl: image,
          cameraName: inspectorName,
          location: cameraLocation,
        })
        result.employee = {
          value,
          confidence,
          matched: Boolean(match),
          name: match?.name || "",
          department: match?.department || "",
          readId: id,
        }
        if (match && confidence >= HIGH_CONFIDENCE) {
          employeeMatch = { name: match.name, employeeNo: match.employeeId }
        }
      }
    }

    // ---- وضع رقم التوك توك ----
    let tuktukMatch: { driverName: string; vehicleNo: string } | null = null
    if (modes.includes("tuktuk") && obj.tuktuk) {
      const tk = obj.tuktuk as { tuktukNumber?: string; confidence?: number }
      const value = (tk.tuktukNumber || "").trim()
      const confidence = normalizeConfidence(tk.confidence)
      if (value && confidence >= MIN_STORE_CONFIDENCE) {
        const { id, match, permitStatus } = await saveTuktukRead({
          tuktukNumber: value,
          confidence,
          imageUrl: image,
          cameraName: inspectorName,
          location: cameraLocation,
        })
        result.tuktuk = {
          value,
          confidence,
          permitStatus,
          driverName: match?.driverName || "",
          documentNo: match?.documentNo || "",
          readId: id,
        }
        // تنبيه مستقل عند تصريح منتهٍ أو غير مطابق (بثقة كافية).
        if ((permitStatus === "expired" || permitStatus === "not_found") && confidence >= HIGH_CONFIDENCE) {
          try {
            await createExpiredPermitAlert({
              tuktukNumber: value,
              permitStatus,
              cameraName: inspectorName,
              location: cameraLocation,
              readId: id,
            })
          } catch {
            /* لا يوقف فشل التنبيه بقية المعالجة */
          }
        }
        if (match && permitStatus === "valid" && confidence >= HIGH_CONFIDENCE) {
          tuktukMatch = { driverName: match.driverName, vehicleNo: value }
        }
      }
    }

    // ---- الوضع المدمج: التعبئة التلقائية عند رصد مخالفة + مطابقة هوية في نفس الإطار ----
    if (detectionRowId && (employeeMatch || tuktukMatch || result.plate)) {
      let identityNote = ""
      if (employeeMatch) {
        result.prefill = { source: "employee_id", employeeName: employeeMatch.name, employeeNo: employeeMatch.employeeNo }
        identityNote = `الموظف المطابق: ${employeeMatch.name} (${employeeMatch.employeeNo})`
      } else if (tuktukMatch) {
        result.prefill = { source: "tuktuk", driverName: tuktukMatch.driverName, vehicleNo: tuktukMatch.vehicleNo }
        identityNote = `سائق التوك توك المطابق: ${tuktukMatch.driverName} (توك توك ${tuktukMatch.vehicleNo})`
      } else if (result.plate) {
        result.prefill = { source: "plate", vehicleNo: result.plate.value }
        identityNote = `لوحة المركبة: ${result.plate.value}`
      }
      // حفظ الهوية المطابقة ضمن ملاحظات الاكتشاف ليجدها المراجع عند تحويله إلى مخالفة.
      if (identityNote) {
        try {
          // نقيّد تحديث الملاحظة بمؤسسة المتصل حتى لا يُعدَّل اكتشاف مؤسسة أخرى.
          const current = await getCurrentUser()
          const orgId = current?.organizationId ?? ""
          const scoped = and(eq(aiDetection.id, detectionRowId), eq(aiDetection.organizationId, orgId))
          const rows = await db
            .select({ notes: aiDetection.notes })
            .from(aiDetection)
            .where(scoped)
            .limit(1)
          const prev = rows[0]?.notes || ""
          const combined = (prev ? `${prev} • ` : "") + identityNote
          await db.update(aiDetection).set({ notes: combined.slice(0, 1000) }).where(scoped)
        } catch {
          /* تجاهل فشل تحديث الملاحظات */
        }
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.log("[v0] recognize route error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: "تعذّر تحليل الصورة" }, { status: 500 })
  }
}
