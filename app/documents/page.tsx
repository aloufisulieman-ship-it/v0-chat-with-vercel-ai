import { FolderKanban, FileText, FileClock, FileCheck2 } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { requireModule } from "@/lib/session"
import { getDocuments } from "@/app/actions/hse"
import { DocumentLibrary, UploadDialog } from "./document-library"

export default async function DocumentsPage() {
  const user = await requireModule("documents")
  const documents = await getDocuments()
  const active = documents.filter((item) => item.status === "active").length
  const review = documents.filter((item) => item.status === "in_progress").length
  const expired = documents.filter((item) => item.status === "expired").length
  const isAdmin = user.role === "admin"

  return (
    <AppShell
      title="إدارة الوثائق"
      subtitle="مكتبة آمنة للسياسات والإجراءات والخطط وسجل إصداراتها"
      user={user}
      action={<UploadDialog />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي الوثائق" value={documents.length} icon={FolderKanban} tone="blue" />
        <KpiCard label="سارية" value={active} icon={FileCheck2} tone="primary" />
        <KpiCard label="قيد المراجعة" value={review} icon={FileClock} tone="accent" />
        <KpiCard label="منتهية" value={expired} icon={FileText} tone="destructive" />
      </div>
      <section className="mt-6" aria-labelledby="documents-library-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div><h2 id="documents-library-title" className="text-lg font-semibold text-foreground">مكتبة الوثائق</h2><p className="mt-1 text-sm text-muted-foreground">اعرض الملفات، نزّلها، وتتبّع تاريخ كل إصدار.</p></div>
          <span className="text-sm text-muted-foreground">{documents.length} وثيقة</span>
        </div>
        <DocumentLibrary documents={documents} admin={isAdmin} />
      </section>
    </AppShell>
  )
}
