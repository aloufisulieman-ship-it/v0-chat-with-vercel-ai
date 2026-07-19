"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, Eye, File, FileImage, FileSpreadsheet, FileText, History, Pencil, Plus, Search, Trash2, UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { deleteDocument, updateDocumentMetadata } from "@/app/actions/hse"
import { toast } from "@/hooks/use-toast"

type Version = { id: number; versionNumber: number; originalFilename: string; fileType: string; fileSize: number; uploaderName: string; notes: string; createdAt: Date }
export type LibraryDocument = { id: number; title: string; category: string | null; version: string | null; owner: string | null; status: string | null; reviewDate: string | null; description: string; fileType: string; fileSize: number; originalFilename: string; uploaderName: string; uploadedAt: Date; updatedAt: Date; currentVersion: number; versions: Version[] }

const statuses: Record<string, string> = { active: "ساري", in_progress: "قيد المراجعة", expired: "منتهٍ" }
const categories = ["سياسات", "إجراءات", "خطط", "نماذج", "سجلات", "أخرى"]
const accepted = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
const fileUrl = (documentId: number, download = false, versionId?: number) => `/api/documents/file?documentId=${documentId}${versionId ? `&versionId=${versionId}` : ""}${download ? "&download=1" : ""}`
const sizeLabel = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} ك.ب` : `${(bytes / 1024 / 1024).toFixed(1)} م.ب`

function TypeIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <FileImage className="size-5 text-primary" />
  if (type.includes("sheet") || type.includes("excel")) return <FileSpreadsheet className="size-5 text-primary" />
  if (type.includes("pdf") || type.includes("word")) return <FileText className="size-5 text-primary" />
  return <File className="size-5 text-primary" />
}

function UploadDialog({ document }: { document?: LibraryDocument }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const isVersion = Boolean(document)
  async function submit(formData: FormData): Promise<void> {
    if (!file) {
      toast({ title: "اختر ملفاً للرفع", variant: "destructive" })
      return
    }
    setUploading(true)
    formData.set("file", file)
    if (document) formData.set("documentId", String(document.id))
    const response = await fetch("/api/documents/upload", { method: "POST", body: formData })
    const result = await response.json()
    setUploading(false)
    if (!response.ok) {
      toast({ title: "تعذر رفع الوثيقة", description: result.error, variant: "destructive" })
      return
    }
    toast({ title: isVersion ? "تم رفع الإصدار الجديد" : "تمت إضافة الوثيقة" })
    setOpen(false); setFile(null); router.refresh()
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size={isVersion ? "sm" : "default"} variant={isVersion ? "outline" : "default"} className="gap-2">{isVersion ? <History className="size-4" /> : <Plus className="size-4" />}{isVersion ? "إصدار جديد" : "رفع وثيقة"}</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" dir="rtl"><DialogHeader><DialogTitle>{isVersion ? `إصدار جديد — ${document?.title}` : "رفع وثيقة جديدة"}</DialogTitle><DialogDescription>الملفات المسموحة: PDF وWord وExcel والصور، بحد أقصى 20 ميجابايت.</DialogDescription></DialogHeader>
      <form action={submit} className="flex flex-col gap-5">
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-6 text-center transition-colors hover:bg-primary/10">
          <UploadCloud className="size-8 text-primary" /><span className="font-medium">{file ? file.name : "اسحب الملف هنا أو اضغط للاختيار"}</span>{file && <span className="text-sm text-muted-foreground">{sizeLabel(file.size)}</span>}
          <input className="sr-only" type="file" accept={accepted} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        {!isVersion && <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="doc-title">اسم الوثيقة</Label><Input id="doc-title" name="title" required /></div>
          <div className="flex flex-col gap-2"><Label>التصنيف</Label><select name="category" className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">اختر التصنيف</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="flex flex-col gap-2"><Label>الإصدار</Label><Input name="version" defaultValue="1.0" /></div>
          <div className="flex flex-col gap-2"><Label>الجهة المالكة</Label><Input name="owner" /></div>
          <div className="flex flex-col gap-2"><Label>الحالة</Label><select name="status" className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="active">ساري</option><option value="in_progress">قيد المراجعة</option><option value="expired">منتهٍ</option></select></div>
          <div className="flex flex-col gap-2"><Label>تاريخ المراجعة</Label><Input name="reviewDate" type="date" /></div>
          <div className="flex flex-col gap-2 sm:col-span-2"><Label>الوصف</Label><Textarea name="description" rows={3} /></div>
        </div>}
        {isVersion && <div className="grid gap-4 sm:grid-cols-2"><div className="flex flex-col gap-2"><Label>رقم الإصدار الظاهر</Label><Input name="version" defaultValue={`${(document?.currentVersion ?? 1) + 1}.0`} /></div><div className="flex flex-col gap-2"><Label>ملاحظات الإصدار</Label><Input name="notes" /></div></div>}
        <DialogFooter><Button type="submit" disabled={uploading}>{uploading ? "جارٍ الرفع..." : "رفع وحفظ"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

function DetailsDialog({ item, admin }: { item: LibraryDocument; admin: boolean }) {
  const previewable = item.fileType === "application/pdf" || item.fileType.startsWith("image/")
  return <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="عرض التفاصيل"><Eye className="size-4" /></Button></DialogTrigger><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl" dir="rtl"><DialogHeader><DialogTitle>{item.title}</DialogTitle><DialogDescription>{item.originalFilename} · {sizeLabel(item.fileSize)}</DialogDescription></DialogHeader>
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div className="overflow-hidden rounded-xl border bg-muted/30">{previewable ? <iframe title={`معاينة ${item.title}`} src={fileUrl(item.id)} className="h-[430px] w-full" /> : <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground"><TypeIcon type={item.fileType} /><p>المعاينة غير متاحة لهذا النوع</p><Button asChild variant="outline"><a href={fileUrl(item.id, true)}>تنزيل الملف</a></Button></div>}</div>
      <div className="flex flex-col gap-5"><div className="rounded-xl border p-4"><h3 className="mb-3 font-semibold">بيانات الوثيقة</h3><dl className="grid grid-cols-2 gap-3 text-sm"><dt className="text-muted-foreground">التصنيف</dt><dd>{item.category || "-"}</dd><dt className="text-muted-foreground">المالك</dt><dd>{item.owner || "-"}</dd><dt className="text-muted-foreground">الإصدار</dt><dd dir="ltr">{item.version}</dd><dt className="text-muted-foreground">الحالة</dt><dd>{statuses[item.status ?? ""]}</dd><dt className="text-muted-foreground">الرافع</dt><dd>{item.uploaderName}</dd></dl>{item.description && <p className="mt-4 border-t pt-4 text-sm leading-6 text-muted-foreground">{item.description}</p>}</div>
        <div><h3 className="mb-3 flex items-center gap-2 font-semibold"><History className="size-4" />تاريخ الإصدارات</h3><div className="flex flex-col gap-2">{item.versions.map((version) => <div key={version.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">الإصدار {version.versionNumber}</p><p className="text-xs text-muted-foreground">{version.uploaderName} · {new Date(version.createdAt).toLocaleDateString("ar-SA")}</p></div><Button asChild variant="ghost" size="icon"><a href={fileUrl(item.id, true, version.id)} aria-label={`تنزيل الإصدار ${version.versionNumber}`}><Download className="size-4" /></a></Button></div>)}</div></div>
        {admin && <UploadDialog document={item} />}
      </div>
    </div>
  </DialogContent></Dialog>
}

function EditDialog({ item }: { item: LibraryDocument }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [pending, startTransition] = useTransition()
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="تعديل الوثيقة"><Pencil className="size-4" /></Button></DialogTrigger><DialogContent dir="rtl"><DialogHeader><DialogTitle>تعديل بيانات الوثيقة</DialogTitle></DialogHeader><form action={(data) => startTransition(async () => { await updateDocumentMetadata(data); toast({ title: "تم تحديث الوثيقة" }); setOpen(false); router.refresh() })} className="grid gap-4"><input type="hidden" name="id" value={item.id} /><div className="flex flex-col gap-2"><Label>الاسم</Label><Input name="title" defaultValue={item.title} required /></div><div className="grid grid-cols-2 gap-4"><div className="flex flex-col gap-2"><Label>التصنيف</Label><Input name="category" defaultValue={item.category ?? ""} /></div><div className="flex flex-col gap-2"><Label>المالك</Label><Input name="owner" defaultValue={item.owner ?? ""} /></div><div className="flex flex-col gap-2"><Label>الحالة</Label><select name="status" defaultValue={item.status ?? "active"} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="active">ساري</option><option value="in_progress">قيد المراجعة</option><option value="expired">منتهٍ</option></select></div><div className="flex flex-col gap-2"><Label>تاريخ المراجعة</Label><Input name="reviewDate" type="date" defaultValue={item.reviewDate ?? ""} /></div></div><div className="flex flex-col gap-2"><Label>الوصف</Label><Textarea name="description" defaultValue={item.description} /></div><DialogFooter><Button disabled={pending}>{pending ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button></DialogFooter></form></DialogContent></Dialog>
}

export function DocumentLibrary({ documents, admin }: { documents: LibraryDocument[]; admin: boolean }) {
  const router = useRouter(); const [query, setQuery] = useState(""); const [category, setCategory] = useState(""); const [status, setStatus] = useState(""); const [pending, startTransition] = useTransition()
  const filtered = useMemo(() => documents.filter((item) => (!query || `${item.title} ${item.originalFilename} ${item.owner}`.toLowerCase().includes(query.toLowerCase())) && (!category || item.category === category) && (!status || item.status === status)), [documents, query, category, status])
  return <div className="flex flex-col gap-4"><div className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الملف أو المالك..." className="pr-9" /></div><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">كل التصنيفات</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">كل الحالات</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="overflow-hidden rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>الوثيقة</TableHead><TableHead>التصنيف</TableHead><TableHead>الإصدار</TableHead><TableHead>الحجم</TableHead><TableHead>المالك</TableHead><TableHead>المراجعة</TableHead><TableHead>الحالة</TableHead><TableHead className="text-left">الإجراءات</TableHead></TableRow></TableHeader><TableBody>{filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="h-40 text-center text-muted-foreground">لا توجد وثائق مطابقة.</TableCell></TableRow> : filtered.map((item) => <TableRow key={item.id}><TableCell><div className="flex items-center gap-3"><span className="rounded-lg bg-primary/10 p-2"><TypeIcon type={item.fileType} /></span><div><p className="font-medium">{item.title}</p><p className="max-w-52 truncate text-xs text-muted-foreground" dir="ltr">{item.originalFilename}</p></div></div></TableCell><TableCell>{item.category || "-"}</TableCell><TableCell dir="ltr">{item.version}</TableCell><TableCell>{sizeLabel(item.fileSize)}</TableCell><TableCell>{item.owner || "-"}</TableCell><TableCell dir="ltr">{item.reviewDate || "-"}</TableCell><TableCell><Badge variant={item.status === "expired" ? "destructive" : item.status === "in_progress" ? "secondary" : "default"}>{statuses[item.status ?? ""] ?? "-"}</Badge></TableCell><TableCell><div className="flex justify-end gap-1"><DetailsDialog item={item} admin={admin} /><Button asChild variant="ghost" size="icon"><a href={fileUrl(item.id, true)} aria-label="تنزيل الوثيقة"><Download className="size-4" /></a></Button>{admin && <><EditDialog item={item} /><Button variant="ghost" size="icon" disabled={pending} onClick={() => { if (!confirm("هل تريد حذف الوثيقة وجميع إصداراتها؟")) return; startTransition(async () => { await deleteDocument(item.id); toast({ title: "تم حذف الوثيقة" }); router.refresh() }) }} aria-label="حذف الوثيقة"><Trash2 className="size-4 text-destructive" /></Button></>}</div></TableCell></TableRow>)}</TableBody></Table></div>
  </div>
}

export { UploadDialog }
