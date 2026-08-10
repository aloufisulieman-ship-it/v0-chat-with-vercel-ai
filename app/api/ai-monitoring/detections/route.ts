import { getDetections } from '@/app/actions/ai-monitoring'

export async function GET() {
  try {
    return Response.json(await getDetections())
  } catch {
    return Response.json({ error: 'غير مصرح' }, { status: 401 })
  }
}
