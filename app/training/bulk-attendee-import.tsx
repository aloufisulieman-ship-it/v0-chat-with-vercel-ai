"use client"

import { useRef, useState } from "react"
import { Upload, FileSpreadsheet, ClipboardPaste, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import * as XLSX from "xlsx"

export type ParsedAttendee = { name: string; designation: string }

// Splits a single line into name + designation using tab, comma, or 2+ spaces.
function splitLine(line: string): ParsedAttendee | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  const parts = trimmed.split(/\t|،|,|\s{2,}/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null
  return { name: parts[0], designation: parts[1] ?? "" }
}

// Heuristically skips a header row (e.g. "الاسم", "name").
function looksLikeHeader(row: ParsedAttendee) {
  const v = `${row.name} ${row.designation}`.toLowerCase()
  return /name|الاسم|designation|الوظيفة|الرقم|no\.?/.test(v)
}

export function BulkAttendeeImport({ onImport }: { onImport: (rows: ParsedAttendee[]) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [parsed, setParsed] = useState<ParsedAttendee[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  function parseText(value: string) {
    const rows = value
      .split(/\r?\n/)
      .map(splitLine)
      .filter((r): r is ParsedAttendee => r !== null)
    const cleaned = rows.length > 0 && looksLikeHeader(rows[0]) ? rows.slice(1) : rows
    setParsed(cleaned)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false })
      const mapped: ParsedAttendee[] = rows
        .map((r) => {
          const name = String(r[0] ?? "").trim()
          if (!name) return null
          return { name, designation: String(r[1] ?? "").trim() }
        })
        .filter((r): r is ParsedAttendee => r !== null)
      const cleaned = mapped.length > 0 && looksLikeHeader(mapped[0]) ? mapped.slice(1) : mapped
      setParsed(cleaned)
      if (cleaned.length === 0) {
        toast({ title: "لم يتم العثور على أسماء في الملف", variant: "destructive" })
      }
    } catch {
      toast({ title: "تعذّر قراءة الملف", description: "تأكد أنه ملف Excel أو CSV صالح.", variant: "destructive" })
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function confirmImport() {
    if (parsed.length === 0) {
      toast({ title: "لا يوجد متدربون للاستيراد", variant: "destructive" })
      return
    }
    onImport(parsed)
    toast({ title: `تم استيراد ${parsed.length} متدرب` })
    reset()
    setOpen(false)
  }

  function reset() {
    setText("")
    setParsed([])
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1">
          <Upload className="size-4" /> استيراد قائمة
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>استيراد قائمة الحضور</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="paste">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste" className="gap-1.5"><ClipboardPaste className="size-4" /> لصق نص</TabsTrigger>
            <TabsTrigger value="file" className="gap-1.5"><FileSpreadsheet className="size-4" /> ملف Excel/CSV</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              الصق اسماً واحداً في كل سطر. لإضافة الوظيفة، افصلها بفاصلة أو مسافتين (مثال: أحمد علي، فني).
            </p>
            <Textarea
              rows={6}
              value={text}
              onChange={(e) => { setText(e.target.value); parseText(e.target.value) }}
              placeholder={"أحمد علي، فني سلامة\nخالد سعيد، مشرف"}
              dir="rtl"
            />
          </TabsContent>

          <TabsContent value="file" className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              العمود الأول = الاسم، العمود الثاني (اختياري) = الوظيفة.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="block w-full text-sm file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm"
            />
          </TabsContent>
        </Tabs>

        {parsed.length > 0 && (
          <div className="rounded-lg border border-border">
            <div className="border-b border-border bg-muted px-3 py-2 text-sm font-semibold">
              معاينة ({parsed.length})
            </div>
            <div className="max-h-48 overflow-y-auto">
              {parsed.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5 text-sm last:border-b-0">
                  <span className="font-medium text-foreground">{i + 1}. {r.name}</span>
                  <span className="text-muted-foreground">{r.designation || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => { reset(); setOpen(false) }} className="gap-1">
            <X className="size-4" /> إلغاء
          </Button>
          <Button type="button" onClick={confirmImport} disabled={parsed.length === 0} className="gap-1">
            <Check className="size-4" /> استيراد {parsed.length > 0 ? `(${parsed.length})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
