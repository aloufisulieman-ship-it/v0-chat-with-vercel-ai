import type { Metadata } from 'next'
import { requireModule } from '@/lib/session'
import { MobileCameraClient } from './mobile-camera-client'

export const metadata: Metadata = {
  title: 'بث كاميرا الهاتف | نظام HSE',
  description: 'تحويل الهاتف إلى مصدر صور مباشر للمراقبة الذكية وتحليل السلامة.',
}

export default async function MobileCameraPage() {
  await requireModule('ai_monitoring')
  return <main className="p-4 sm:p-6" dir="rtl"><MobileCameraClient /></main>
}
