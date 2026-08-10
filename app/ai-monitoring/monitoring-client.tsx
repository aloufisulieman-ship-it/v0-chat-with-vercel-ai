'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { AlertTriangle, Ban, Boxes, Camera, Gauge, HardHat, TrafficCone } from 'lucide-react'
import { toast } from 'sonner'
import { updateDetectionStatus } from '@/app/actions/ai-monitoring'
import { ViolationFormDialog, type ViolationPrefill } from '@/app/violations/violation-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const fetcher = (url: string) => fetch(url).then(r => r.json())
const types = {
  pedestrian_near_forklift: { label: 'اقتراب مشاة من رافعة', icon: AlertTriangle }, restricted_area_entry: { label: 'دخول منطقة محظورة', icon: Ban },
  overspeed: { label: 'سرعة زائدة', icon: Gauge }, unsafe_stacking: { label: 'تكديس غير آمن', icon: Boxes },
  traffic_congestion: { label: 'ازدحام مروري', icon: TrafficCone }, missing_ppe: { label: 'عدم ارتداء الوقاية', icon: HardHat },
} as const
const severityLabel: Record<string,string> = { low:'منخفض', medium:'متوسط', high:'عالٍ', critical:'حرج' }
const statusLabel: Record<string,string> = { new:'جديد', acknowledged:'مؤكد', resolved:'مغلق', false_positive:'إنذار خاطئ' }
const severityClass: Record<string,string> = { critical:'bg-destructive', high:'bg-orange-500', medium:'bg-yellow-500', low:'bg-muted-foreground' }
type Detection = { id:number; detectionId:string; cameraId:string; cameraLocation:string; detectionType:keyof typeof types; severity:string; confidenceScore:string; snapshotUrl:string; detectedAt:string; status:string; notes?:string }

export function MonitoringClient({ initial, employees }: { initial: Detection[]; employees: any[] }) {
  const { data = initial, mutate } = useSWR<Detection[]>('/api/ai-monitoring/detections', fetcher, { refreshInterval: 10000 })
  const [selected, setSelected] = useState<Detection | null>(null)
  const [filters, setFilters] = useState({ type:'all', severity:'all', camera:'all', status:'all', date:'' })
  const filtered = useMemo(() => data.filter(d => (filters.type==='all'||d.detectionType===filters.type) && (filters.severity==='all'||d.severity===filters.severity) && (filters.camera==='all'||d.cameraId===filters.camera) && (filters.status==='all'||d.status===filters.status) && (!filters.date||d.detectedAt.slice(0,10)===filters.date)), [data, filters])
  const today = new Date().toISOString().slice(0,10)
  const cameras = [...new Set(data.map(d => d.cameraId))]
  const locations = [...new Set(data.map(d => d.cameraLocation))]
  const prefill: ViolationPrefill | undefined = selected ? { violationType: types[selected.detectionType].label, place:selected.cameraLocation, violationDate:selected.detectedAt.slice(0,10), violationTime:new Date(selected.detectedAt).toLocaleTimeString('ar-SA'), description:`اكتشاف آلي ${selected.detectionId}: ${selected.notes || types[selected.detectionType].label}`, images:[selected.snapshotUrl] } : undefined
  async function setStatus(status:'acknowledged'|'false_positive') { if(!selected)return; await updateDetectionStatus(selected.id,status); toast.success(status==='acknowledged'?'تم تأكيد المخالفة':'تم رفض الإنذار'); setSelected(null); mutate() }

  return <div className="flex flex-col gap-6">
    <div className="flex justify-end"><Button asChild><Link href="/ai-monitoring/mobile-camera"><Camera data-icon="inline-start" />بث كاميرا الهاتف</Link></Button></div>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{Object.entries(types).map(([key,item])=>{const Icon=item.icon; return <Card key={key}><CardHeader className="flex-row items-center justify-between gap-2 pb-2"><CardTitle className="text-sm">{item.label}</CardTitle><Icon className="size-5 text-primary" /></CardHeader><CardContent><strong className="font-mono text-3xl">{data.filter(d=>d.detectionType===key&&d.detectedAt.slice(0,10)===today).length}</strong><p className="text-xs text-muted-foreground">حالة اليوم</p></CardContent></Card>})}</section>
    <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card><CardHeader><CardTitle>خريطة مناطق الرصد الحية</CardTitle></CardHeader><CardContent className="grid min-h-72 gap-3 sm:grid-cols-2">{locations.length?locations.map(location=>{const hits=data.filter(d=>d.cameraLocation===location&&d.status==='new'); const worst=hits.find(d=>d.severity==='critical')?.severity||hits.find(d=>d.severity==='high')?.severity||hits.find(d=>d.severity==='medium')?.severity||'low'; return <button key={location} className="flex flex-col justify-between rounded-xl border bg-muted/30 p-4 text-right hover:bg-muted" onClick={()=>setFilters(f=>({...f,camera:data.find(d=>d.cameraLocation===location)?.cameraId||'all'}))}><span className="font-semibold">{location}</span><span className="flex items-center gap-2 text-sm text-muted-foreground"><i className={`size-3 rounded-full ${severityClass[worst]}`} />{hits.length} تنبيهات نشطة</span></button>}):<p className="m-auto text-muted-foreground">لا توجد مناطق مرصودة بعد</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>التصفية والتحكم</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{[['type','كل الأنواع',Object.entries(types).map(([v,x])=>[v,x.label])],['severity','كل الخطورات',Object.entries(severityLabel)],['camera','كل الكاميرات',cameras.map(x=>[x,x])],['status','كل الحالات',Object.entries(statusLabel)]].map(([name,all,options]:any)=><select key={name} value={(filters as any)[name]} onChange={e=>setFilters(f=>({...f,[name]:e.target.value}))} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">{all}</option>{options.map(([v,l]:string[])=><option key={v} value={v}>{l}</option>)}</select>)}<input type="date" value={filters.date} onChange={e=>setFilters(f=>({...f,date:e.target.value}))} className="h-10 rounded-md border bg-background px-3 text-sm" /><Button variant="outline" onClick={()=>setFilters({type:'all',severity:'all',camera:'all',status:'all',date:''})}>مسح الفلاتر</Button></CardContent></Card>
    </section>
    <Card><CardHeader><CardTitle>البث المباشر للاكتشافات</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>الوقت</TableHead><TableHead>الكاميرا</TableHead><TableHead>المخالفة</TableHead><TableHead>الخطورة</TableHead><TableHead>الثقة</TableHead><TableHead>الإثبات</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader><TableBody>{filtered.map(d=><TableRow key={d.id} className="cursor-pointer" onClick={()=>setSelected(d)}><TableCell className="font-mono text-xs" dir="ltr">{new Date(d.detectedAt).toLocaleString('ar-SA')}</TableCell><TableCell>{d.cameraId}<small className="block text-muted-foreground">{d.cameraLocation}</small></TableCell><TableCell>{types[d.detectionType]?.label}</TableCell><TableCell><Badge variant={d.severity==='critical'?'destructive':'secondary'}>{severityLabel[d.severity]}</Badge></TableCell><TableCell className="min-w-28"><span className="font-mono">{Number(d.confidenceScore).toFixed(0)}%</span><Progress value={Number(d.confidenceScore)} /></TableCell><TableCell><img src={d.snapshotUrl} alt={`إثبات ${d.detectionId}`} className="size-12 rounded-md object-cover" /></TableCell><TableCell><Badge variant="outline">{statusLabel[d.status]}</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    <Dialog open={!!selected} onOpenChange={o=>!o&&setSelected(null)}><DialogContent className="max-w-3xl" dir="rtl"><DialogHeader><DialogTitle>{selected?.detectionId}</DialogTitle><DialogDescription>تفاصيل الاكتشاف وإجراءات المعالجة</DialogDescription></DialogHeader>{selected&&<div className="flex flex-col gap-4"><img src={selected.snapshotUrl} alt="إطار الاكتشاف الكامل" className="max-h-96 w-full rounded-xl object-contain bg-muted" /><div className="grid gap-2 text-sm sm:grid-cols-2"><p><b>الموقع:</b> {selected.cameraLocation}</p><p><b>الكاميرا:</b> {selected.cameraId}</p><p><b>النوع:</b> {types[selected.detectionType].label}</p><p><b>الثقة:</b> {Number(selected.confidenceScore).toFixed(1)}%</p></div><div className="flex flex-wrap gap-2"><Button onClick={()=>setStatus('acknowledged')}>تأكيد المخالفة</Button><Button variant="destructive" onClick={()=>setStatus('false_positive')}>رفض كإنذار خاطئ</Button><ViolationFormDialog employees={employees} prefill={prefill} triggerLabel="إحالة كمخالفة رسمية" /></div></div>}</DialogContent></Dialog>
  </div>
}
