// ثوابت وأنواع مشتركة لموديول تتبع المركبات. مفصولة عن ملف الـ server actions لأن
// ملفات "use server" لا يُسمح فيها إلا بتصدير دوال async.

// عدد بوابات السوق.
export const GATE_COUNT = 7

export type VehicleStatus = "outside" | "inside" | "blocked"

export type GateActionResult = {
  ok: boolean
  action: "entry" | "exit" | "sighting" | "blocked" | "error"
  message: string
  plate: string
  status?: VehicleStatus
  // عند رفض الخروج: تفاصيل المخالفات المرتبطة بالدخول الحالي.
  blockingViolations?: { id: number; type: string; severity: string; at: string }[]
}

// مصدر التسجيل: تلقائي بالكاميرا أو يدوي بواسطة موظف.
export type EntryMethod = "auto" | "manual"
export type EntrySightingDto = { id: number; cameraId: string; location: string; at: string; method: EntryMethod }
export type EntryViolationDto = { id: number; type: string; severity: string; at: string; source: string }
export type VehicleEntryDto = {
  id: number
  entryGateId: number
  entryTime: string
  exitTime: string | null
  exitGateId: number | null
  status: string
  method: EntryMethod
  sightings: EntrySightingDto[]
  violations: EntryViolationDto[]
}
export type VehicleDetailDto = {
  id: number
  plateNumber: string
  vehicleType: string
  currentStatus: VehicleStatus
  entries: VehicleEntryDto[]
}
// مصدر فريمات الوضع التلقائي لبوابة: كاميرا جهاز المتصفح أو بث خارجي من خادم جسر.
export type FrameSource = "device" | "external"
export type GateSettingDto = {
  gateNumber: number
  frameSource: FrameSource
  lastFrameAt: string | null
  lastPlate: string | null
}

export type TrackingOverview = { inside: number; outside: number; blocked: number; total: number }
export type PresentVehicleDto = {
  id: number
  plateNumber: string
  vehicleType: string
  status: VehicleStatus
  entryGateId: number
  entryTime: string
}
