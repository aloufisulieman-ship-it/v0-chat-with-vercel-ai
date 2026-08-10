import { generateText, Output } from 'ai'
import { z } from 'zod'
import { createDetection } from '@/app/actions/ai-monitoring'

export const runtime = 'nodejs'

const requestSchema = z.object({
  image: z.string().min(1),
  cameraId: z.string().min(1).max(100),
  cameraLocation: z.string().min(1).max(150),
})
const detectionSchema = z.object({
  detected: z.boolean(),
  detectionType: z.enum(['pedestrian_near_forklift','restricted_area_entry','overspeed','unsafe_stacking','traffic_congestion','missing_ppe']).nullable(),
  severity: z.enum(['low','medium','high','critical']).nullable(),
  confidenceScore: z.number().min(0).max(100),
  boundingBox: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).nullable(),
  notes: z.string(),
})

export async function POST(request: Request) {
  const configuredKey = process.env.AI_MONITORING_API_KEY
  if (!configuredKey) return Response.json({ error: 'AI_MONITORING_API_KEY غير مهيأ' }, { status: 503 })
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (token !== configuredKey) return Response.json({ error: 'غير مصرح' }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json())
  if (!parsed.success) return Response.json({ error: 'بيانات الإطار غير صالحة' }, { status: 400 })
  const { image, cameraId, cameraLocation } = parsed.data
  const imagePart = image.startsWith('data:')
    ? { type: 'image' as const, image: Buffer.from(image.split(',')[1] ?? '', 'base64') }
    : { type: 'image' as const, image: new URL(image) }

  const { output } = await generateText({
    model: 'anthropic/claude-sonnet-4.6',
    output: Output.object({ schema: detectionSchema }),
    messages: [{ role: 'user', content: [
      imagePart,
      { type: 'text', text: `أنت محلل سلامة صناعية لساحات الرافعات الشوكية. افحص الإطار وصنّف فقط: pedestrian_near_forklift, restricted_area_entry, overspeed, unsafe_stacking, traffic_congestion, missing_ppe. لا تخمّن. إن وجدت مخالفة أعد النوع والخطورة والثقة من 0 إلى 100 وصندوقاً محيطاً بإحداثيات نسبية 0-1 وملاحظة عربية موجزة. الكاميرا: ${cameraId}، الموقع: ${cameraLocation}.` },
    ] }],
  })
  if (!output.detected || !output.detectionType || !output.severity) return Response.json({ detected: false })
  const detection = await createDetection({
    cameraId, cameraLocation, snapshotUrl: image,
    detectionType: output.detectionType, severity: output.severity,
    confidenceScore: output.confidenceScore, boundingBox: output.boundingBox, notes: output.notes,
  })
  return Response.json({ detected: true, detection }, { status: 201 })
}
