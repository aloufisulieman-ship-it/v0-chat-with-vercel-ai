import { getUnreadAiNotifications, markAiNotificationsRead } from '@/app/actions/ai-monitoring'

export async function GET() {
  try {
    const notifications = await getUnreadAiNotifications()
    return Response.json({ count: notifications.length, notifications })
  } catch { return Response.json({ count: 0, notifications: [] }) }
}
export async function POST() {
  await markAiNotificationsRead()
  return Response.json({ ok: true })
}
