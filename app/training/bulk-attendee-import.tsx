"use client"

import { useRef, useState } from "react"
import { Upload, FileSpreadsheet, ClipboardPaste, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import * as XLSX from "xlsx"
import { useI18n } from "@/lib/i18n/client"

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
  const { t, dir } = useI18n()
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
        toast({ title: t("trainingExtras.noNamesInFile"), variant: "destructive" })
      }
    } catch {
      toast({
        title: t("trainingExtras.fileReadFailed"),
        description: t("trainingExtras.fileReadFailedDesc"),
        variant: "destructive",
      })
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function confirmImport() {
    if (parsed.length === 0) {
      toast({ title: t("trainingExtras.noTraineesToImport"), variant: "destructive" })
      return
    }
    onImport(parsed)
    toast({ title: t("trainingExtras.importedCount").replace("{count}", String(parsed.length)) })
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
          <Upload className="size-4" /> {t("trainingExtras.importList")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" dir={dir}>
        <DialogHeader>
          <DialogTitle>{t("trainingExtras.importAttendanceTitle")}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="paste">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste" className="gap-1.5">
              <ClipboardPaste className="size-4" /> {t("trainingExtras.tabPaste")}
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-1.5">
              <FileSpreadsheet className="size-4" /> {t("trainingExtras.tabFile")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{t("trainingExtras.pasteHint")}</p>
            <Textarea
              rows={6}
              value={text}
              onChange={(e) => { setText(e.target.value); parseText(e.target.value) }}
              placeholder={t("trainingExtras.pastePlaceholder")}
              dir={dir}
            />
          </TabsContent>

          <TabsContent value="file" className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{t("trainingExtras.fileHint")}</p>
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
              {t("trainingExtras.preview")} ({parsed.length})
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
            <X className="size-4" /> {t("trainingExtras.cancel")}
          </Button>
          <Button type="button" onClick={confirmImport} disabled={parsed.length === 0} className="gap-1">
            <Check className="size-4" /> {t("trainingExtras.importAction")} {parsed.length > 0 ? `(${parsed.length})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
