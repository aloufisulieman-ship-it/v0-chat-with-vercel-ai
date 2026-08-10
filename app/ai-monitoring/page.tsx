import { AppShell } from '@/components/app-shell'
import { getDetections } from '@/app/actions/ai-monitoring'
import { getEmployees } from '@/app/actions/hse'
import { requireModule } from '@/lib/session'
import { MonitoringClient } from './monitoring-client'

export const metadata = { title: 'المراقبة الذكية بالكاميرات | HSE', description: 'تحليل مباشر لمخاطر ساحات الرافعات الشوكية' }

export default async function AiMonitoringPage() {
  const user = await requireModule('ai_monitoring')
  const [detections, employees] = await Promise.all([getDetections(), getEmployees()])
  return <AppShell title="المراقبة الذكية بالكاميرات" subtitle="تحليل مباشر لساحات الرافعات وتنبيهات السلامة المدعومة بالذكاء الاصطناعي" user={user}>
    <MonitoringClient initial={JSON.parse(JSON.stringify(detections))} employees={employees} />
  </AppShell>
}
