"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Camera,
  MapPin,
  Clock,
  AlertTriangle,
  Eye,
  CheckCircle,
  Plus,
  Trash2,
  Send,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  Truck,
  Users,
  PersonStanding,
  HardHat,
  Footprints,
  ShieldAlert,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"

// حقل التوقيع يعتمد على DOM، لذا يُحمّل ديناميكياً بدون SSR.
const SignaturePad = dynamic(() => import("./signature-field"), {
  ssr: false,
  loading: () => <div className="h-[160px] w-full rounded-md border border-gray-300 bg-white" />,
})

type EntryType = "violation" | "observation" | "positive"
type ViolationCategory = "forklift" | "tuktuk" | "loading" | "vest" | "crossing" | "shoes" | "other"

interface ViolationTemplate {
  id: string
  category: ViolationCategory
  text: string
  severity: "minor" | "moderate" | "serious"
}

interface PatrolEntry {
  id: string
  type: EntryType
  time: string
  location: string
  description: string
  category?: ViolationCategory
  severity?: "minor" | "moderate" | "serious"
  photos: string[]
  workerCount?: number
  employeeName?: string
  companyName?: string
  employeeNo?: string // رقم الهوية أو الوظيفي
  equipmentNo?: string // رقم المعدة
  equipmentType?: string // نوع المعدة
  violatorSignature?: string // توقيع المخالف (base64) — اختياري
  inspectorSignature?: string // توقيع مفتش السلامة (base64) — إلزامي
  violatorRefused?: boolean // رفض المخالف التوقيع
  status: "draft" | "saving" | "saved" | "error"
  documentNo?: string
  errorMsg?: string
}

interface PatrolSession {
  id: string
  date: string
  startTime: string
  endTime?: string
  officerName: string
  vehicleId: string
  route: string
  entries: PatrolEntry[]
  notes: string
}

const VIOLATION_CATEGORIES: {
  value: ViolationCategory
  label: string
  icon: typeof Truck
  color: string
  bg: string
}[] = [
  { value: "forklift", label: "رافعة شوكية", icon: Truck, color: "#dc2626", bg: "#fef2f2" },
  { value: "tuktuk", label: "توك توك", icon: Truck, color: "#7c3aed", bg: "#f5f3ff" },
  { value: "loading", label: "شحن وتفريغ", icon: Users, color: "#d97706", bg: "#fffbeb" },
  { value: "vest", label: "سترة عاكسة", icon: PersonStanding, color: "#0284c7", bg: "#f0f9ff" },
  { value: "crossing", label: "ممرات المشاة", icon: Footprints, color: "#059669", bg: "#f0fdf4" },
  { value: "shoes", label: "جوتي السلامة", icon: HardHat, color: "#b45309", bg: "#fefce8" },
  { value: "other", label: "أخرى", icon: ShieldAlert, color: "#6b7280", bg: "#f9fafb" },
]

const VIOLATION_TEMPLATES: ViolationTemplate[] = [
  { id: "F1", category: "forklift", severity: "serious", text: "قيادة الرافعة بسرعة زائدة داخل السوق" },
  { id: "F2", category: "forklift", severity: "serious", text: "رافعة شوكية في منطقة مشاة بدون تحذير" },
  { id: "F3", category: "forklift", severity: "moderate", text: "عدم ارتداء حزام الأمان أثناء قيادة الرافعة" },
  { id: "F4", category: "forklift", severity: "moderate", text: "قيادة الرافعة بحمل مرفوع بشكل خاطئ" },
  { id: "F5", category: "forklift", severity: "serious", text: "قيادة الرافعة بدون رخصة HSE سارية" },
  { id: "F6", category: "forklift", severity: "moderate", text: "ترك الرافعة تعمل بدون مراقبة" },
  { id: "F7", category: "forklift", severity: "minor", text: "عدم استخدام بوق التحذير عند الاقتراب من التقاطعات" },
  { id: "F8", category: "forklift", severity: "serious", text: "حمل أشخاص على الرافعة الشوكية" },
  { id: "T1", category: "tuktuk", severity: "serious", text: "قيادة التوك توك بسرعة زائدة داخل السوق" },
  { id: "T2", category: "tuktuk", severity: "moderate", text: "عدم ارتداء حزام الأمان في التوك توك" },
  { id: "T3", category: "tuktuk", severity: "serious", text: "قيادة التوك توك بدون رخصة HSE سارية" },
  { id: "T4", category: "tuktuk", severity: "moderate", text: "تجاوز الحمولة المسموحة في التوك توك" },
  { id: "T5", category: "tuktuk", severity: "minor", text: "التوك توك في مسار مخصص للرافعات الشوكية" },
  { id: "T6", category: "tuktuk", severity: "moderate", text: "حمل أكثر من الطاقة الاستيعابية من الأشخاص" },
  { id: "L1", category: "loading", severity: "serious", text: "رفع أحمال يدوياً بطريقة خاطئة" },
  { id: "L2", category: "loading", severity: "moderate", text: "عمال في منطقة تشغيل الرافعة بدون تنسيق" },
  { id: "L3", category: "loading", severity: "serious", text: "الوقوف تحت حمل مرفوع بالرافعة" },
  { id: "L4", category: "loading", severity: "moderate", text: "بضائع غير مؤمّنة على البليت قبل الرفع" },
  { id: "L5", category: "loading", severity: "minor", text: "عمال التفريغ بدون قفازات حماية" },
  { id: "L6", category: "loading", severity: "moderate", text: "إعاقة ممر الطوارئ بالبضائع أثناء التفريغ" },
  { id: "L7", category: "loading", severity: "serious", text: "عمال على سطح الشاحنة بدون حماية من السقوط" },
  { id: "V1", category: "vest", severity: "moderate", text: "عامل في ساحة التحميل بدون سترة عاكسة" },
  { id: "V2", category: "vest", severity: "moderate", text: "عامل مستودع في مسار المركبات بدون سترة عاكسة" },
  { id: "V3", category: "vest", severity: "minor", text: "سترة عاكسة مرتداة بشكل غير صحيح" },
  { id: "V4", category: "vest", severity: "moderate", text: "زائر في منطقة العمليات بدون سترة عاكسة" },
  { id: "V5", category: "vest", severity: "moderate", text: "سائق مركبة نزل بدون سترة عاكسة" },
  { id: "C1", category: "crossing", severity: "serious", text: "عبور المشاة من خارج الممر المخصص" },
  { id: "C2", category: "crossing", severity: "serious", text: "مشاة يسيرون في مسار الرافعات الشوكية" },
  { id: "C3", category: "crossing", severity: "moderate", text: "تجاهل إشارات التوقف عند الممر" },
  { id: "C4", category: "crossing", severity: "moderate", text: "ممر مشاة محجوب ببضائع أو مركبات" },
  { id: "C5", category: "crossing", severity: "minor", text: "مشاة يستخدمون هواتفهم عند العبور" },
  { id: "S1", category: "shoes", severity: "moderate", text: "عامل في منطقة التحميل بدون حذاء سلامة" },
  { id: "S2", category: "shoes", severity: "moderate", text: "عامل مستودع يرتدي أحذية عادية أثناء التشغيل" },
  { id: "S3", category: "shoes", severity: "minor", text: "عامل يرتدي أحذية سلامة تالفة" },
  { id: "S4", category: "shoes", severity: "moderate", text: "عامل فرز بدون حذاء واق من الثقل" },
  { id: "O1", category: "other", severity: "moderate", text: "التدخين في منطقة ممنوعة" },
  { id: "O2", category: "other", severity: "minor", text: "إلقاء النفايات خارج الحاويات المخصصة" },
  { id: "O3", category: "other", severity: "moderate", text: "العمل بدون تصريح عمل ساري" },
  { id: "O4", category: "other", severity: "serious", text: "تجاهل تعليمات مسؤول السلامة" },
]

const OBSERVATION_TEMPLATES = [
  "إضاءة غير كافية في المنطقة",
  "أرضية زلقة أو متشققة",
  "علامات تحذيرية مفقودة أو تالفة",
  "ممر مشاة يحتاج تجديد الدهان",
  "تسرب زيت من رافعة شوكية",
  "طفاية حريق تحتاج فحص دوري",
  "مرايا التقاطعات تحتاج تعديل",
  "معدات مكسورة تحتاج صيانة",
]

const POSITIVE_TEMPLATES = [
  "التزام كامل بمعدات الحماية الشخصية",
  "سلوك قيادة ممتاز وآمن",
  "استجابة فورية لتعليمات السلامة",
  "ترتيب ومنظومة ممتازة في المنطقة",
  "تعاون إيجابي مع فريق HSE",
]

const LOCATIONS = [
  "البوابة الرئيسية",
  "البوابة الخلفية",
  "ساحة التحميل أ",
  "ساحة التحميل ب",
  "ساحة التحميل ج",
  "ممر الرافعات الرئيسي",
  "منطقة تقاطع المركبات",
  "مستودع A",
  "مستودع B",
  "مستودع C",
  "مستودع D",
  "منطقة الفرز",
  "منطقة التغليف",
  "منطقة التخزين البارد",
  "ممر المشاة الرئيسي",
  "ممر المشاة الجانبي",
  "موقف السيارات",
  "مكاتب الإدارة",
  "المطعم والاستراحة",
  "منطقة النفايات",
]

const SEVERITY_LABELS = {
  minor: { label: "بسيطة", color: "#16a34a", bg: "#f0fdf4" },
  moderate: { label: "متوسطة", color: "#d97706", bg: "#fffbeb" },
  serious: { label: "جسيمة", color: "#dc2626", bg: "#fef2f2" },
}

function generateId(prefix: string) {
  const year = new Date().getFullYear()
  const num = String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")
  return `${prefix}-${year}-${num}`
}
function nowTime() {
  return new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
}

// ── حفظ المخالفة في قاعدة البيانات ───────────────────────────────────────────────
// تُرسل بيانات المخالفة إلى /api/patrol-violation الذي يستدعي نفس دالة
// createViolationFull المستخدمة في نموذج المخالفات. تُطابَق أسماء الحقول مع عقد
// المسار (place / violationDate / violationTime / images) ليُحفظ السجل ويظهر في /violations.
async function saveViolationToDB(entry: PatrolEntry): Promise<{ documentNo: string }> {
  const description = entry.equipmentNo
    ? `${entry.description} — رقم المعدة: ${entry.equipmentNo}${entry.equipmentType ? ` (${entry.equipmentType})` : ""}`
    : entry.description
  const res = await fetch("/api/patrol-violation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      employeeName: entry.employeeName || "غير محدد",
      employeeNo: entry.employeeNo || "",
      companyName: entry.companyName || "MHS",
      violationType: entry.description,
      place: entry.location,
      description,
      violationDate: new Date().toISOString().slice(0, 10),
      violationTime: entry.time,
      status: "open",
      images: entry.photos,
      violatorSignature: entry.violatorSignature || "",
      inspectorSignature: entry.inspectorSignature || "",
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || "فشل الحفظ")
  }
  return res.json()
}

// ── حفظ الملاحظة/الإيجابية في قاعدة البيانات ────────────────────────────────────
// تُرسل بيانات الملاحظة (observation) أو الإيجابية (positive) إلى
// /api/patrol-observation ليُحفظ السجل ويظهر في لوحة التحكم والتقارير.
async function saveObservationToDB(entry: PatrolEntry): Promise<{ documentNo: string }> {
  const res = await fetch("/api/patrol-observation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: entry.type, // "observation" | "positive"
      description: entry.description,
      location: entry.location,
      observationDate: new Date().toISOString().slice(0, 10),
      observationTime: entry.time,
      status: "open",
      images: entry.photos,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || "فشل الحفظ")
  }
  return res.json()
}

// ── Photo Capture ──────────────────────────────────────────────────────────────

function PhotoCapture({ onCapture }: { onCapture: (b: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (!f) return
          const r = new FileReader()
          r.onload = () => onCapture(r.result as string)
          r.readAsDataURL(f)
          e.target.value = ""
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold"
        style={{ background: "#1e3a5f", color: "#fff" }}
      >
        <Camera size={15} /> صورة
      </button>
    </>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────────

function SaveBadge({
  status,
  documentNo,
  errorMsg,
}: {
  status: PatrolEntry["status"]
  documentNo?: string
  errorMsg?: string
}) {
  if (status === "saving")
    return (
      <span className="text-xs flex items-center gap-1 text-blue-400">
        <CloudUpload size={12} className="animate-pulse" /> جاري الحفظ...
      </span>
    )
  if (status === "saved")
    return (
      <span className="text-xs flex items-center gap-1 text-green-500 font-bold" dir="ltr">
        <CheckCircle2 size={12} /> {documentNo}
      </span>
    )
  if (status === "error")
    return (
      <span className="text-xs flex items-center gap-1 text-red-400">
        <AlertCircle size={12} /> {errorMsg || "فشل الحفظ"}
      </span>
    )
  return <span className="text-xs text-gray-300">مسودة</span>
}

// ── Entry Card ───────────────────────────────────────────────────────────────�����

function EntryCard({
  entry,
  onDelete,
  onRetry,
}: {
  entry: PatrolEntry
  onDelete: () => void
  onRetry?: () => void
}) {
  const [open, setOpen] = useState(false)
  const catInfo = VIOLATION_CATEGORIES.find((c) => c.value === entry.category)
  const sevInfo = entry.severity ? SEVERITY_LABELS[entry.severity] : null
  const borderColor =
    entry.type === "violation" ? "#ef4444" : entry.type === "observation" ? "#f59e0b" : "#22c55e"

  return (
    <div
      className="rounded-2xl overflow-hidden mb-3"
      style={{ background: "#fff", border: `1.5px solid ${borderColor}25`, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => setOpen(!open)}>
        {catInfo && (
          <div className="rounded-xl p-2 flex-shrink-0" style={{ background: catInfo.bg }}>
            <catInfo.icon size={17} style={{ color: catInfo.color }} />
          </div>
        )}
        {!catInfo && (
          <div
            className="rounded-xl p-2 flex-shrink-0"
            style={{ background: entry.type === "positive" ? "#f0fdf4" : "#fffbeb" }}
          >
            {entry.type === "positive" ? (
              <CheckCircle size={17} style={{ color: "#22c55e" }} />
            ) : (
              <Eye size={17} style={{ color: "#f59e0b" }} />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            {catInfo && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: catInfo.bg, color: catInfo.color }}
              >
                {catInfo.label}
              </span>
            )}
            {sevInfo && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: sevInfo.bg, color: sevInfo.color }}
              >
                {sevInfo.label}
              </span>
            )}
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <Clock size={10} /> {entry.time}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-800 leading-snug">{entry.description}</p>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <MapPin size={10} /> {entry.location}
            {entry.workerCount && entry.workerCount > 1 && (
              <span className="text-blue-500 font-bold">· {entry.workerCount} عمال</span>
            )}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <SaveBadge status={entry.status} documentNo={entry.documentNo} errorMsg={entry.errorMsg} />
            {entry.status === "error" && onRetry && (
              <button
                onClick={(ev) => {
                  ev.stopPropagation()
                  onRetry()
                }}
                className="text-xs font-bold text-blue-500 flex items-center gap-1"
              >
                <RefreshCw size={11} /> إعادة المحاولة
              </button>
            )}
          </div>
        </div>
        <div>
          {open ? (
            <ChevronUp size={15} className="text-gray-300" />
          ) : (
            <ChevronDown size={15} className="text-gray-300" />
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-3 pb-3">
          {/* تفاصيل المخالف */}
          {(entry.employeeName || entry.employeeNo || entry.companyName || entry.equipmentNo) && (
            <div className="mt-2 rounded-xl p-2.5 space-y-1.5" style={{ background: "#f8fafc" }}>
              {entry.employeeName && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">الاسم</span>
                  <span className="font-bold text-gray-700">{entry.employeeName}</span>
                </div>
              )}
              {entry.companyName && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">الشركة</span>
                  <span className="font-bold text-gray-700">{entry.companyName}</span>
                </div>
              )}
              {entry.employeeNo && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">رقم الهوية / الوظيفي</span>
                  <span className="font-bold text-gray-700 font-mono" dir="ltr">
                    {entry.employeeNo}
                  </span>
                </div>
              )}
              {entry.equipmentNo && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">رقم المعدة</span>
                  <span className="font-bold text-gray-700 font-mono" dir="ltr">
                    {entry.equipmentNo}
                  </span>
                </div>
              )}
              {entry.equipmentType && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">نوع المعدة</span>
                  <span className="font-bold text-gray-700">{entry.equipmentType}</span>
                </div>
              )}
            </div>
          )}
          {entry.photos.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
              {entry.photos.map((p, i) => (
                <img
                  key={i}
                  src={p || "/placeholder.svg"}
                  alt=""
                  className="h-20 w-20 object-cover rounded-xl flex-shrink-0"
                />
              ))}
            </div>
          )}
          <div className="flex justify-end mt-2">
            <button onClick={onDelete} className="text-xs text-red-400 flex items-center gap-1">
              <Trash2 size={12} /> حذف
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add Entry Modal ────────────────────────────────────────────────────────────

function AddEntryModal({
  onClose,
  onAdd,
  officerName,
}: {
  onClose: () => void
  onAdd: (e: PatrolEntry) => void
  officerName: string
}) {
  const [step, setStep] = useState<"type" | "category" | "template" | "details">("type")
  const [entryType, setEntryType] = useState<EntryType>("violation")
  const [category, setCategory] = useState<ViolationCategory>("forklift")
  const [template, setTemplate] = useState<ViolationTemplate | null>(null)
  const [customText, setCustomText] = useState("")
  const [location, setLocation] = useState(LOCATIONS[0])
  const [photos, setPhotos] = useState<string[]>([])
  const [workerCount, setWorkerCount] = useState(1)
  const [employeeName, setEmployeeName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [employeeNo, setEmployeeNo] = useState("")
  const [equipmentNo, setEquipmentNo] = useState("")
  const [equipmentType, setEquipmentType] = useState("")
  const [obsText, setObsText] = useState("")
  const [posText, setPosText] = useState("")
  const [violatorSignature, setViolatorSignature] = useState("")
  const [inspectorSignature, setInspectorSignature] = useState("")
  const [violatorRefused, setViolatorRefused] = useState(false)

  const filteredTemplates = VIOLATION_TEMPLATES.filter((t) => t.category === category)

  const handleSave = () => {
    const desc =
      entryType === "violation"
        ? template
          ? template.text
          : customText
        : entryType === "observation"
          ? obsText
          : posText
    if (!desc.trim()) return
    // توقيع المفتش إلزامي للمخالفات؛ توقيع المخالف اختياري (أو رفض التوقيع).
    if (entryType === "violation" && !inspectorSignature) return
    onAdd({
      id: generateId("OBS"),
      type: entryType,
      time: nowTime(),
      location,
      description: desc,
      category: entryType === "violation" ? category : undefined,
      severity: entryType === "violation" && template ? template.severity : undefined,
      photos,
      workerCount: workerCount > 1 ? workerCount : undefined,
      employeeName: employeeName || undefined,
      companyName: companyName || undefined,
      employeeNo: employeeNo || undefined,
      equipmentNo: equipmentNo || undefined,
      equipmentType: equipmentType || undefined,
      violatorSignature: entryType === "violation" && !violatorRefused ? violatorSignature || undefined : undefined,
      inspectorSignature: entryType === "violation" ? inspectorSignature || undefined : undefined,
      violatorRefused: entryType === "violation" ? violatorRefused || undefined : undefined,
      status: "draft",
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="w-full rounded-t-2xl" style={{ background: "#f8fafc", maxHeight: "92vh", overflowY: "auto" }}>
        <div
          className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
          style={{ background: "#1e3a5f" }}
        >
          <div className="flex items-center gap-2">
            {step !== "type" && (
              <button
                onClick={() =>
                  setStep(
                    step === "details"
                      ? entryType === "violation"
                        ? "template"
                        : "type"
                      : step === "template"
                        ? "category"
                        : "type",
                  )
                }
              >
                <ChevronDown size={20} className="text-white rotate-90" />
              </button>
            )}
            <h2 className="text-white font-bold">
              {step === "type"
                ? "نوع التسجيل"
                : step === "category"
                  ? "فئة المخالفة"
                  : step === "template"
                    ? "اختر المخالفة"
                    : "تفاصيل إضافية"}
            </h2>
          </div>
          <button onClick={onClose}>
            <X size={20} className="text-white" />
          </button>
        </div>

        <div className="p-4">
          {step === "type" && (
            <div className="space-y-3">
              {[
                {
                  v: "violation" as EntryType,
                  label: "مخالفة سلامة",
                  sub: "تُحفظ فوراً في قاعدة البيانات",
                  color: "#ef4444",
                  icon: AlertTriangle,
                },
                {
                  v: "observation" as EntryType,
                  label: "ملاحظة ميدانية",
                  sub: "خطر محتمل يحتاج متابعة",
                  color: "#f59e0b",
                  icon: Eye,
                },
                {
                  v: "positive" as EntryType,
                  label: "سلوك إيجابي",
                  sub: "التزام يستحق التقدير",
                  color: "#22c55e",
                  icon: CheckCircle,
                },
              ].map((t) => (
                <button
                  key={t.v}
                  onClick={() => {
                    setEntryType(t.v)
                    setStep(t.v === "violation" ? "category" : "details")
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-right"
                  style={{ background: "#fff", border: `1.5px solid ${t.color}20`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${t.color}15` }}
                  >
                    <t.icon size={22} style={{ color: t.color }} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{t.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === "category" && (
            <div className="grid grid-cols-2 gap-3">
              {VIOLATION_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => {
                    setCategory(cat.value)
                    setTemplate(null)
                    setStep("template")
                  }}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2"
                  style={{ background: cat.bg, borderColor: `${cat.color}30` }}
                >
                  <cat.icon size={26} style={{ color: cat.color }} />
                  <span className="text-sm font-bold" style={{ color: cat.color }}>
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === "template" && (
            <div className="space-y-2">
              {filteredTemplates.map((t) => {
                const sev = SEVERITY_LABELS[t.severity]
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTemplate(t)
                      setCustomText("")
                      setStep("details")
                    }}
                    className="w-full text-right p-3.5 rounded-2xl flex items-start gap-3"
                    style={{
                      background: template?.id === t.id ? "#1e3a5f" : "#fff",
                      border: `1.5px solid ${template?.id === t.id ? "#1e3a5f" : "#e5e7eb"}`,
                    }}
                  >
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                      style={{ background: sev.bg, color: sev.color }}
                    >
                      {sev.label}
                    </span>
                    <span
                      className={`text-sm font-medium leading-snug ${template?.id === t.id ? "text-white" : "text-gray-700"}`}
                    >
                      {t.text}
                    </span>
                  </button>
                )
              })}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 mb-2">أو اكتب وصفاً مخصصاً</p>
                <textarea
                  value={customText}
                  onChange={(e) => {
                    setCustomText(e.target.value)
                    setTemplate(null)
                  }}
                  rows={2}
                  placeholder="اكتب المخالفة..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none"
                  dir="rtl"
                />
                {customText.trim() && (
                  <button
                    onClick={() => setStep("details")}
                    className="w-full mt-2 py-2.5 rounded-xl font-bold text-sm text-white"
                    style={{ background: "#1e3a5f" }}
                  >
                    متابعة ←
                  </button>
                )}
              </div>
            </div>
          )}

          {step === "details" && (
            <div className="space-y-4">
              {entryType === "violation" && (template || customText) && (
                <div className="p-3 rounded-xl" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <p className="text-xs font-bold text-red-500 mb-1">المخالفة</p>
                  <p className="text-sm font-semibold text-gray-800">{template ? template.text : customText}</p>
                  {template && (
                    <span
                      className="text-xs font-bold mt-1 inline-block px-2 py-0.5 rounded-full"
                      style={{
                        background: SEVERITY_LABELS[template.severity].bg,
                        color: SEVERITY_LABELS[template.severity].color,
                      }}
                    >
                      {SEVERITY_LABELS[template.severity].label}
                    </span>
                  )}
                </div>
              )}

              {entryType === "observation" && (
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-2">الملاحظة</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {OBSERVATION_TEMPLATES.map((o) => (
                      <button
                        key={o}
                        onClick={() => setObsText(o)}
                        className="text-xs px-3 py-1.5 rounded-full border"
                        style={{
                          borderColor: obsText === o ? "#f59e0b" : "#e5e7eb",
                          background: obsText === o ? "#fffbeb" : "#fff",
                          color: obsText === o ? "#d97706" : "#374151",
                          fontWeight: obsText === o ? "700" : "400",
                        }}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={obsText}
                    onChange={(e) => setObsText(e.target.value)}
                    rows={2}
                    placeholder="أو اكتب الملاحظة..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none"
                    dir="rtl"
                  />
                </div>
              )}

              {entryType === "positive" && (
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-2">السلوك الإيجابي</label>
                  <div className="flex flex-wrap gap-2">
                    {POSITIVE_TEMPLATES.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPosText(p)}
                        className="text-xs px-3 py-1.5 rounded-full border"
                        style={{
                          borderColor: posText === p ? "#22c55e" : "#e5e7eb",
                          background: posText === p ? "#f0fdf4" : "#fff",
                          color: posText === p ? "#16a34a" : "#374151",
                          fontWeight: posText === p ? "700" : "400",
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* تفاصيل المخالف — للمخالفات فقط */}
              {entryType === "violation" && (
                <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid #fecaca" }}>
                  <div className="px-3 py-2" style={{ background: "#fef2f2" }}>
                    <p className="text-xs font-black text-red-500">بيانات المخالف</p>
                  </div>
                  <div className="p-3 space-y-3" style={{ background: "#fff" }}>
                    {/* الاسم والشركة */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">الاسم</label>
                        <input
                          value={employeeName}
                          onChange={(e) => setEmployeeName(e.target.value)}
                          placeholder="اسم المخالف"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                          dir="rtl"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">الشركة</label>
                        <input
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="MHS"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                          dir="rtl"
                        />
                      </div>
                    </div>
                    {/* رقم الهوية / الوظيفي */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">رقم الهوية / الرقم الوظيفي</label>
                      <input
                        value={employeeNo}
                        onChange={(e) => setEmployeeNo(e.target.value)}
                        placeholder="مثال: 12345678"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                        dir="ltr"
                      />
                    </div>
                    {/* رقم المعدة ونوعها — تظهر فقط للفئات ذات الصلة */}
                    {(category === "forklift" || category === "tuktuk") && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1">رقم المعدة</label>
                          <input
                            value={equipmentNo}
                            onChange={(e) => setEquipmentNo(e.target.value)}
                            placeholder="مثال: FL-07"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1">نوع المعدة</label>
                          <select
                            value={equipmentType}
                            onChange={(e) => setEquipmentType(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                            dir="rtl"
                          >
                            <option value="">اختر...</option>
                            {category === "forklift" && (
                              <>
                                <option>رافعة شوكية كهربائية</option>
                                <option>رافعة شوكية ديزل</option>
                                <option>رافعة شوكية غاز</option>
                                <option>ريتش تراك</option>
                                <option>باليت تراك كهربائي</option>
                              </>
                            )}
                            {category === "tuktuk" && (
                              <>
                                <option>توك توك كهربائي</option>
                                <option>توك توك بنزين</option>
                                <option>عربة نقل صغيرة</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">الموقع</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                  dir="rtl"
                >
                  {LOCATIONS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>

              {entryType === "violation" && (
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">عدد المخالفين</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setWorkerCount((n) => Math.max(1, n - 1))}
                      className="w-10 h-10 rounded-xl font-bold text-lg"
                      style={{ background: "#f1f5f9" }}
                    >
                      −
                    </button>
                    <span className="text-xl font-black text-gray-800 w-8 text-center">{workerCount}</span>
                    <button
                      onClick={() => setWorkerCount((n) => n + 1)}
                      className="w-10 h-10 rounded-xl font-bold text-lg text-white"
                      style={{ background: "#1e3a5f" }}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-2">صور الدليل ({photos.length})</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <PhotoCapture onCapture={(b) => setPhotos((p) => [...p, b])} />
                  {photos.map((p, i) => (
                    <div key={i} className="relative">
                      <img src={p || "/placeholder.svg"} alt="" className="h-14 w-14 object-cover rounded-xl" />
                      <button
                        onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: "#ef4444", color: "#fff" }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* قسم التوقيعات — للمخالفات فقط */}
              {entryType === "violation" && (
                <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid #e5e7eb" }}>
                  <div className="px-3 py-2" style={{ background: "#f8fafc" }}>
                    <p className="text-xs font-black text-gray-600">التوقيعات</p>
                  </div>
                  <div className="p-3 space-y-4" style={{ background: "#fff" }}>
                    {/* توقيع المخالف — اختياري مع خيار رفض التوقيع */}
                    <div className="space-y-2">
                      <SignaturePad
                        label="توقيع المخالف (اختياري)"
                        value={violatorSignature}
                        onChange={setViolatorSignature}
                        disabled={violatorRefused}
                        disabledText="رفض المخالف التوقيع"
                      />
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                        <input
                          type="checkbox"
                          checked={violatorRefused}
                          onChange={(e) => {
                            setViolatorRefused(e.target.checked)
                            if (e.target.checked) setViolatorSignature("")
                          }}
                          className="size-4 accent-red-500"
                        />
                        رفض المخالف التوقيع
                      </label>
                    </div>
                    {/* توقيع مفتش السلامة — إلزامي، يظهر اسم الضابط كعنوان */}
                    <SignaturePad
                      label={`توقيع مفتش السلامة — ${officerName}`}
                      value={inspectorSignature}
                      onChange={setInspectorSignature}
                    />
                    {!inspectorSignature && (
                      <p className="text-xs font-bold text-red-500">توقيع المفتش إلزامي قبل الحفظ</p>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={
                  entryType === "violation"
                    ? (!template && !customText.trim()) || !inspectorSignature
                    : entryType === "observation"
                      ? !obsText.trim()
                      : !posText.trim()
                }
                className="w-full py-3.5 rounded-2xl font-black text-white text-base disabled:opacity-30"
                style={{ background: "#1e3a5f" }}
              >
                {entryType === "violation" ? "حفظ في قاعدة البيانات" : "حفظ التسجيل"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Summary Sheet ──────────────────────────────────────────────────────────────

function SummarySheet({
  session,
  onClose,
  onRetry,
  onFinish,
}: {
  session: PatrolSession
  onClose: () => void
  onRetry?: (id: string) => void
  onFinish: () => void
}) {
  const [saving, setSaving] = useState(false)
  const violations = session.entries.filter((e) => e.type === "violation")
  const observations = session.entries.filter((e) => e.type === "observation")
  const positives = session.entries.filter((e) => e.type === "positive")
  // إحصاءات الحفظ تشمل جميع البنود (مخالفات + ملاحظات + إيجابيات).
  const saved = session.entries.filter((e) => e.status === "saved").length
  const failed = session.entries.filter((e) => e.status === "error").length

  // التأكيد النهائي لإنهاء الجولة: تُسجَّل الجولة كمكتملة، ثم يُنتقل مباشرة
  // لشاشة بدء جولة تفتيشية جديدة (كل البنود محفوظة مسبقاً في Neon لحظة تسجيلها).
  const handleSave = async () => {
    setSaving(true)
    try {
      const completed = { ...session, status: "completed", endTime: session.endTime || "" }
      localStorage.setItem("hse_patrol_v3", JSON.stringify(completed))
      onFinish()
    } finally {
      setSaving(false)
    }
  }

  // الإغلاق عبر X: أغلق نافذة الملخص فقط والبقاء في الجولة الحالية.
  const handleClose = () => {
    onClose()
  }

  // الطباعة: افتح نافذة الطباعة ثم انتقل لشاشة بدء جولة جديدة بعد انتهائها/إغلاقها.
  const handlePrint = () => {
    const after = () => {
      window.removeEventListener("afterprint", after)
      onFinish()
    }
    window.addEventListener("afterprint", after)
    window.print()
  }

  const catStats = VIOLATION_CATEGORIES.map((cat) => ({
    ...cat,
    count: violations.filter((v) => v.category === cat.value).length,
  })).filter((c) => c.count > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "#fff", maxHeight: "85vh", overflowY: "auto" }}>
        <div className="p-4" style={{ background: "#1e3a5f" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-white font-black">ملخص الجولة الميدانية</h2>
            <button onClick={handleClose}>
              <X size={20} className="text-white" />
            </button>
          </div>
          <p className="text-blue-300 text-xs mt-1">
            {session.id} · {session.date}
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "مخالفات", value: violations.length, color: "#ef4444" },
              { label: "ملاحظات", value: observations.length, color: "#f59e0b" },
              { label: "إيجابيات", value: positives.length, color: "#22c55e" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl py-3" style={{ background: `${s.color}10` }}>
                <p className="text-3xl font-black" style={{ color: s.color }}>
                  {s.value}
                </p>
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {session.entries.length > 0 && (
            <div
              className="rounded-xl p-3 flex items-center gap-2"
              style={{ background: saved === session.entries.length ? "#f0fdf4" : "#fffbeb" }}
            >
              {saved === session.entries.length ? (
                <CheckCircle2 size={16} className="text-green-500" />
              ) : (
                <AlertCircle size={16} className="text-yellow-500" />
              )}
              <p
                className="text-sm font-bold"
                style={{ color: saved === session.entries.length ? "#16a34a" : "#d97706" }}
              >
                {saved} من {session.entries.length} بند محفوظ في النظام
                {failed > 0 ? ` · ${failed} فشل الحفظ` : ""}
              </p>
            </div>
          )}

          {/* حالة الحفظ الفعلية لكل بند (مخالفات + ملاحظات + إيجابيات) */}
          {session.entries.length > 0 && (
            <div className="rounded-2xl p-3 space-y-2" style={{ background: "#f8fafc" }}>
              <p className="text-xs font-black text-gray-500 mb-1">حالة الحفظ في النظام</p>
              {session.entries.map((v) => (
                <div key={v.id} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background:
                        v.type === "violation" ? "#ef4444" : v.type === "observation" ? "#f59e0b" : "#22c55e",
                    }}
                  />
                  <span className="text-sm text-gray-700 flex-1 truncate">{v.description}</span>
                  {v.status === "saved" && (
                    <span className="text-xs font-bold text-green-600 flex items-center gap-1" dir="ltr">
                      <CheckCircle2 size={12} /> {v.documentNo}
                    </span>
                  )}
                  {v.status === "saving" && (
                    <span className="text-xs text-blue-400 flex items-center gap-1">
                      <CloudUpload size={12} className="animate-pulse" /> جاري الحفظ
                    </span>
                  )}
                  {v.status === "error" && (
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                        <AlertCircle size={12} /> فشل الحفظ
                      </span>
                      {onRetry && (
                        <button
                          onClick={() => onRetry(v.id)}
                          className="text-xs font-bold text-blue-500 flex items-center gap-1"
                        >
                          <RefreshCw size={11} /> إعادة
                        </button>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {catStats.length > 0 && (
            <div className="rounded-2xl p-3 space-y-2" style={{ background: "#f8fafc" }}>
              <p className="text-xs font-black text-gray-500 mb-2">توزيع المخالفات</p>
              {catStats.map((c) => (
                <div key={c.value} className="flex items-center gap-2">
                  <c.icon size={13} style={{ color: c.color }} />
                  <span className="text-sm text-gray-700 flex-1">{c.label}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${(c.count / violations.length) * 100}%`, background: c.color }}
                    />
                  </div>
                  <span className="text-sm font-black" style={{ color: c.color }}>
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl p-3 space-y-1.5" style={{ background: "#f1f5f9" }}>
            {(
              [
                ["الضابط", session.officerName],
                ["المركبة", session.vehicleId],
                ["المسار", session.route],
                ["البداية", session.startTime],
                ["النهاية", session.endTime || "—"],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-400">{k}</span>
                <span className="font-bold text-gray-800">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex-1 py-3.5 rounded-2xl font-black text-white flex items-center justify-center gap-2"
              style={{ background: "#1e3a5f" }}
            >
              <FileText size={16} /> طباعة تقرير الجولة
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3.5 rounded-2xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "#16a34a" }}
            >
              <CheckCircle2 size={16} /> {saving ? "جاري الإنهاء..." : "إنهاء الجولة"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────────

export function PatrolClient() {
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<PatrolSession | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [notes, setNotes] = useState("")
  const [officerName, setOfficerName] = useState("سليمان العوفي")
  const [vehicleId, setVehicleId] = useState("HSE-01")
  const [route, setRoute] = useState("الجولة الكاملة")

  useEffect(() => {
    const saved = localStorage.getItem("hse_patrol_v3")
    if (saved) {
      const s = JSON.parse(saved)
      setSession(s)
      setNotes(s.notes || "")
    }
  }, [])

  useEffect(() => {
    if (session) localStorage.setItem("hse_patrol_v3", JSON.stringify({ ...session, notes }))
  }, [session, notes])

  const startSession = () =>
    setSession({
      id: generateId("PAT"),
      date: new Date().toLocaleDateString("ar-SA"),
      startTime: nowTime(),
      officerName,
      vehicleId,
      route,
      entries: [],
      notes: "",
    })

  const patchEntry = (id: string, patch: Partial<PatrolEntry>) =>
    setSession((s) => (s ? { ...s, entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : s))

  // الحفظ الفعلي لبند مخالفة في قاعدة البيانات عبر createViolationFull.
  // يُحدّث حالة البند إلى محفوظ/فاشل، ويعرض تنبيهاً فورياً مع خيار إعادة المحاولة عند الفشل.
  const runSave = async (entry: PatrolEntry) => {
    patchEntry(entry.id, { status: "saving", errorMsg: undefined })
    const isViolation = entry.type === "violation"
    const failTitle = isViolation ? "فشل حفظ المخالفة" : "فشل حفظ الملاحظة"
    try {
      // المخالفات تُحفظ في سجل المخالفات؛ الملاحظات والإيجابيات في سجل الملاحظات.
      const result = isViolation ? await saveViolationToDB(entry) : await saveObservationToDB(entry)
      patchEntry(entry.id, { status: "saved", documentNo: result.documentNo })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل الحفظ"
      patchEntry(entry.id, { status: "error", errorMsg: msg })
      toast({
        variant: "destructive",
        title: failTitle,
        description: `${entry.description} — ${msg}`,
        action: (
          <ToastAction altText="إعادة المحاولة" onClick={() => runSave(entry)}>
            إعادة المحاولة
          </ToastAction>
        ),
      })
    }
  }

  const addEntry = async (entry: PatrolEntry) => {
    // تظهر فوراً في القائمة، وكل البنود تبدأ بحالة "جاري الحفظ" لأنها تُحفظ تلقائياً.
    setSession((s) => (s ? { ...s, entries: [...s.entries, { ...entry, status: "saving" }] } : s))

    // الحفظ التلقائي الفوري لكل بند: المخالفات + الملاحظات + الإيجابيات.
    await runSave(entry)
  }

  // إعادة محاولة حفظ بند فشل حفظه (من بطاقة البند أو من شاشة الملخص).
  const retryEntry = (id: string) => {
    const entry = session?.entries.find((e) => e.id === id)
    if (entry) runSave(entry)
  }

  const delEntry = (id: string) =>
    setSession((s) => (s ? { ...s, entries: s.entries.filter((e) => e.id !== id) } : s))
  const endSession = () => {
    setSession((s) => (s ? { ...s, endTime: nowTime(), notes } : s))
    setShowSummary(true)
  }

  // إنهاء الجولة الحالية والانتقال مباشرة لشاشة بدء جولة تفتيشية جديدة
  // (بدل العودة للقائمة الرئيسية). البنود محفوظة مسبقاً في قاعدة البيانات لحظة تسجيلها.
  const finishAndStartNew = () => {
    localStorage.removeItem("hse_patrol_v3")
    setShowSummary(false)
    setShowAdd(false)
    setNotes("")
    setSession(null)
  }

  const violations = session?.entries.filter((e) => e.type === "violation").length ?? 0
  const observations = session?.entries.filter((e) => e.type === "observation").length ?? 0
  const positives = session?.entries.filter((e) => e.type === "positive").length ?? 0

  if (!session)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-5" style={{ background: "#f8fafc" }} dir="rtl">
        <div className="w-full max-w-sm space-y-5">
          <div className="flex justify-start">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="gap-1 text-gray-600 hover:text-gray-900"
            >
              <ArrowRight size={16} /> رجوع للرئيسية
            </Button>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "#1e3a5f" }}>
              <ShieldAlert size={30} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">جولة HSE الميدانية</h1>
            <p className="text-gray-400 text-sm mt-1">السوق المركزي · المخالفات تُحفظ تلقائياً</p>
          </div>

          <div className="rounded-2xl p-4 space-y-3" style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            {[
              { label: "ضابط السلامة", val: officerName, set: setOfficerName },
              { label: "رقم جولة التفتيش", val: vehicleId, set: setVehicleId },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="text-xs font-bold text-gray-500 block mb-1">{label}</label>
                <input
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  dir="rtl"
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">مسار الجولة</label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                dir="rtl"
              >
                {["الجولة الكاملة", "ساحة التحميل والرافعات", "المستودعات", "البوابات والمداخل", "الممرات والمشاة"].map(
                  (r) => (
                    <option key={r}>{r}</option>
                  ),
                )}
              </select>
            </div>
          </div>

          <button
            onClick={startSession}
            className="w-full py-4 rounded-2xl font-black text-white text-lg flex items-center justify-center gap-2"
            style={{ background: "#1e3a5f" }}
          >
            <MapPin size={20} /> بدء الجولة الميدانية
          </button>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f8fafc" }} dir="rtl">
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{ background: "#1e3a5f" }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-blue-300 text-xs font-mono">{session.id}</p>
            <h1 className="text-white font-black text-lg">الجولة الميدانية</h1>
            <p className="text-blue-300 text-xs mt-0.5">
              {session.officerName} · {session.vehicleId} · بدأت {session.startTime}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSummary(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
            >
              ملخص
            </button>
            <button
              onClick={endSession}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
              style={{ background: "#ef4444", color: "#fff" }}
            >
              <Send size={12} /> إنهاء
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "مخالفة", value: violations, color: "#f87171" },
            { label: "ملاحظة", value: observations, color: "#fbbf24" },
            { label: "إيجابية", value: positives, color: "#4ade80" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl py-2 text-center" style={{ background: "rgba(255,255,255,0.1)" }}>
              <p className="text-2xl font-black" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-4 pb-32">
        {session.entries.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <ShieldAlert size={44} className="mx-auto mb-3 opacity-20" />
            <p className="font-bold text-gray-400">لا توجد تسجيلات بعد</p>
            <p className="text-sm mt-1 text-gray-400">المخالفات تُحفظ تلقائياً في النظام</p>
          </div>
        ) : (
            session.entries.map((e) => (
              <EntryCard key={e.id} entry={e} onDelete={() => delEntry(e.id)} onRetry={() => retryEntry(e.id)} />
            ))
        )}
        <div className="mt-4">
          <label className="text-sm font-bold text-gray-500 block mb-2">ملاحظات الجولة العامة</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="أي ملاحظات عامة..."
            className="w-full border border-gray-100 rounded-2xl px-4 py-3 text-sm resize-none"
            style={{ background: "#fff" }}
            dir="rtl"
          />
        </div>
      </div>

      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-95 transition-transform"
        style={{ background: "#1e3a5f" }}
      >
        <Plus size={30} className="text-white" />
      </button>

      {showAdd && (
        <AddEntryModal onClose={() => setShowAdd(false)} onAdd={addEntry} officerName={session.officerName} />
      )}
      {showSummary && (
        <SummarySheet
          session={{ ...session, notes }}
          onClose={() => setShowSummary(false)}
          onRetry={retryEntry}
          onFinish={finishAndStartNew}
        />
      )}
    </div>
  )
}
