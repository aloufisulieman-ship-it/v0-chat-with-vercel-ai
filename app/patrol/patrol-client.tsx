"use client"

import { useState } from "react"
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Plus,
  ClipboardList,
  ExternalLink,
  RotateCcw,
  User,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const VIOLATION_TYPES = [
  "عدم ارتداء خوذة السلامة",
  "عدم ارتداء حذاء السلامة",
  "عدم ارتداء سترة عاكسة",
  "عدم ارتداء قفازات واقية",
  "عدم ارتداء نظارات واقية",
  "عدم ارتداء كمامة أو جهاز تنفس",
  "عدم ارتداء حزام الأمان للعمل على الارتفاع",
  "العمل بدون تصريح عمل",
  "تجاوز منطقة العمل المحددة",
  "مخالفة إجراءات العزل والقفل (LOTO)",
  "استخدام معدات تالفة أو غير مطابقة",
  "تشغيل معدات بدون تدريب أو ترخيص",
  "الإهمال في تأمين منطقة العمل",
  "عدم الإبلاغ عن حادثة أو إصابة",
  "إهمال نظافة موقع العمل",
  "عدم التخلص الصحيح من النفايات",
  "سد مخارج الطوارئ أو ممرات الإخلاء",
  "تخزين مواد بطريقة غير آمنة",
  "التشتت أو استخدام الهاتف أثناء العمل",
  "الإهمال المتعمد في اتباع تعليمات السلامة",
  "التدخين في مناطق محظورة",
  "السير في مسارات المركبات",
  "قيادة مركبة بسرعة زائدة داخل الموقع",
  "عدم ارتداء حزام الأمان في المركبة",
  "استخدام الجوال أثناء القيادة",
  "التعامل مع مواد خطرة بدون مؤهل",
  "مخالفة أخرى",
]

type EntryStatus = "saving" | "saved" | "error"

type PatrolEntry = {
  tempId: string
  employeeName: string
  violationType: string
  place: string
  companyName: string
  description: string
  status: EntryStatus
  documentNo?: string
  error?: string
}

const emptyForm = {
  employeeName: "",
  employeeNo: "",
  companyName: "",
  violationType: "",
  place: "",
  description: "",
}

// التاريخ والوقت الحاليان بصيغة مناسبة لقاعدة البيانات والعرض العربي.
function nowParts() {
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const time = d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
  return { date, time }
}

export function PatrolClient() {
  const [form, setForm] = useState(emptyForm)
  const [entries, setEntries] = useState<PatrolEntry[]>([])

  // يرسل مخالفة الجولة إلى مسار API ويحدّث حالتها (جاري الحفظ → محفوظة/خطأ).
  async function sendEntry(entry: PatrolEntry) {
    const { date, time } = nowParts()
    try {
      const res = await fetch("/api/patrol-violation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeName: entry.employeeName,
          companyName: entry.companyName,
          violationType: entry.violationType,
          place: entry.place,
          description: entry.description,
          violationDate: date,
          violationTime: time,
          status: "open",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "تعذّر الحفظ")
      setEntries((prev) =>
        prev.map((e) => (e.tempId === entry.tempId ? { ...e, status: "saved", documentNo: data.documentNo } : e)),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذّر الحفظ"
      setEntries((prev) => prev.map((e) => (e.tempId === entry.tempId ? { ...e, status: "error", error: message } : e)))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employeeName.trim() || !form.violationType) return

    const entry: PatrolEntry = {
      tempId: crypto.randomUUID(),
      employeeName: form.employeeName.trim(),
      violationType: form.violationType,
      place: form.place.trim(),
      companyName: form.companyName.trim(),
      description: form.description.trim(),
      status: "saving",
    }
    // تظهر فوراً في أعلى القائمة بحالة "جاري الحفظ".
    setEntries((prev) => [entry, ...prev])
    // أعِد ضبط حقول المخالفة مع الإبقاء على اسم الموظف والشركة لتسريع التسجيل المتتابع.
    setForm((f) => ({ ...f, violationType: "", place: "", description: "" }))
    void sendEntry(entry)
  }

  function retry(tempId: string) {
    setEntries((prev) => prev.map((e) => (e.tempId === tempId ? { ...e, status: "saving", error: undefined } : e)))
    const entry = entries.find((e) => e.tempId === tempId)
    if (entry) void sendEntry({ ...entry, status: "saving" })
  }

  const savedCount = entries.filter((e) => e.status === "saved").length
  const savingCount = entries.filter((e) => e.status === "saving").length

  return (
    <div className="flex flex-col gap-6">
      {/* نموذج التسجيل السريع */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-5 text-primary" /> تسجيل مخالفة أثناء الجولة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label>
                اسم الموظف <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.employeeName}
                onChange={(e) => setForm((f) => ({ ...f, employeeName: e.target.value }))}
                placeholder="الاسم الكامل"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>اسم الشركة</Label>
              <Input
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                placeholder="اختياري"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>
                نوع المخالفة <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.violationType}
                onValueChange={(v) => setForm((f) => ({ ...f, violationType: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع المخالفة..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {VIOLATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>المكان</Label>
              <Input
                value={form.place}
                onChange={(e) => setForm((f) => ({ ...f, place: e.target.value }))}
                placeholder="موقع المخالفة في الجولة"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>الرقم الوظيفي</Label>
              <Input
                value={form.employeeNo}
                onChange={(e) => setForm((f) => ({ ...f, employeeNo: e.target.value }))}
                placeholder="اختياري"
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>وصف مختصر (اختياري)</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="تفاصيل إضافية..."
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={!form.employeeName.trim() || !form.violationType} className="gap-2">
                <Plus className="size-4" /> تسجيل وإرسال للمخالفات
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* قائمة مخالفات الجولة */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ClipboardList className="size-5 text-muted-foreground" /> مخالفات هذه الجولة ({entries.length})
          </h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {savingCount > 0 && <span>{savingCount} قيد الحفظ</span>}
            {savedCount > 0 && (
              <Link href="/violations" className="flex items-center gap-1 text-primary hover:underline">
                عرض في سجل المخالفات <ExternalLink className="size-3.5" />
              </Link>
            )}
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            لم تُسجَّل أي مخالفة بعد. ابدأ بتسجيل أول مخالفة في الجولة.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li
                key={entry.tempId}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <User className="size-4 shrink-0 text-muted-foreground" />
                    {entry.employeeName}
                  </span>
                  <span className="text-sm text-muted-foreground line-clamp-1">{entry.violationType}</span>
                  {entry.place && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {entry.place}
                    </span>
                  )}
                </div>

                <div className="shrink-0">
                  {entry.status === "saving" && (
                    <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> جاري الحفظ...
                    </span>
                  )}
                  {entry.status === "saved" && (
                    <span
                      className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
                      dir="ltr"
                    >
                      <CheckCircle2 className="size-3.5" /> {entry.documentNo}
                    </span>
                  )}
                  {entry.status === "error" && (
                    <button
                      type="button"
                      onClick={() => retry(entry.tempId)}
                      className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
                      title={entry.error}
                    >
                      <AlertCircle className="size-3.5" /> فشل — إعادة المحاولة <RotateCcw className="size-3" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
