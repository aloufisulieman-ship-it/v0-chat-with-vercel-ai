import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getViolations, getEmployees, deleteViolation, getAiViolationSignatureInfo, getCompany } from "@/app/actions/hse"
import type { EmailSenderInfo } from "@/lib/email-export"
import { getOperationalSettings } from "@/app/actions/org-settings"
import { getServerT } from "@/lib/i18n/server"
import { statusLabel, categoryLabel } from "@/lib/i18n/labels"
import { effectiveViolationStatus, isViolationClosed } from "@/lib/violation-status"
import { FileWarning, Clock, CheckCircle2 } from "lucide-react"
import { MissingOriginalField } from "@/components/missing-original-field"
import { HrStatusBadge } from "@/components/hr-status-badge"
import { HrClosureBlock } from "@/components/hr-closure-block"
import { FinanceStatusBadge } from "@/components/finance-status-badge"
import { FinanceClosureBlock } from "@/components/finance-closure-block"
import { EntryModeBadge } from "@/components/entry-mode-badge"
import { ViolationFormDialog } from "./violation-form"
import { ViolationEditDialog } from "./violation-edit-dialog"

type Violation = Awaited<ReturnType<typeof getViolations>>[number]

async function handleDelete(id: number) {
  "use server"
  await deleteViolation(id)
}

export default async function ViolationsPage({
  searchParams,
}: {
  searchParams: Promise<{ evidence?: string; from?: string; detectedBy?: string }>
}) {
  const user = await requireModule("violations")
  const [violations, employees, operational, aiSignatureInfo, companyProfile] = await Promise.all([
    getViolations(),
    getEmployees(),
    getOperationalSettings(),
    getAiViolationSignatureInfo(),
    getCompany().catch(() => null),
  ])
  const violationTypeLabels = operational.violationTypes.map((v) => v.label)
  const { t, locale } = await getServerT()
  // بيانات المُرسل المُلحقة تلقائياً بتوقيع رسالة البريد الرسمية.
  const emailSender: EmailSenderInfo = {
    companyName: companyProfile?.name || undefined,
    phone: companyProfile?.phone || undefined,
    email: companyProfile?.email || undefined,
    address: companyProfile?.address || undefined,
  }
  // مصدر الرصد في نص الرسالة: الرصد الآلي (من المراقبة الذكية)، وإلا بلاغ (إدخال يدوي)
  // أو جولة تفتيشية (إدخال إلكتروني).
  const detectionSource = (r: Violation) => {
    const en = locale === "en"
    if (aiSignatureInfo[r.id]) return en ? "Automated detection" : "الرصد الآلي"
    if (r.entryMode === "manual") return en ? "Report" : "بلاغ"
    return en ? "Inspection round" : "جولة تفتيشية"
  }
  const isAdmin = user.role === "admin"
  const NOT_IN_SOURCE = t("violations.notInSource")

  // عند القدوم من صفحة التسجيلات نفتح نموذج المخالفة تلقائياً مع تحميل اللقطة كدليل.
  const sp = await searchParams
  const initialEvidence = typeof sp.evidence === "string" ? sp.evidence : undefined
  const initialDetectedBy = typeof sp.detectedBy === "string" ? sp.detectedBy : ""
  const autoOpen = sp.from === "recording" && !!initialEvidence

  // العدادات تعتمد الحالة الفعلية (وفق مسار الإحالة) لا الحالة المخزّنة.
  const closed = violations.filter((v) => isViolationClosed(v)).length
  const open = violations.length - closed

  const columns: Column<Violation>[] = [
    { key: "employeeName", header: t("violations.colEmployee"), render: (r) => <span className="font-medium">{r.employeeName}</span> },
    { key: "employeeNo", header: t("violations.colEmployeeNo"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.employeeNo || "-"}</span> },
    { key: "description", header: t("violations.colDescription"), render: (r) => r.description ? <span className="text-muted-foreground line-clamp-1 max-w-xs">{r.description}</span> : <MissingOriginalField value={null} /> },
    { key: "place", header: t("violations.colPlace"), render: (r) => <MissingOriginalField value={r.place} /> },
    { key: "detectedBy", header: t("violations.colDetectedBy"), render: (r) => r.detectedBy ? <span className="text-muted-foreground">{r.detectedBy}</span> : <span className="text-muted-foreground">-</span> },
    { key: "violationDate", header: t("violations.colDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.violationDate ?? "-"}</span> },
    { key: "status", header: t("violations.colStatus"), render: (r) => <StatusBadge status={effectiveViolationStatus(r)} /> },
    { key: "entryMode", header: t("violations.colSource"), render: (r) => <EntryModeBadge entryMode={r.entryMode} /> },
    {
      key: "referral", header: t("violations.colReferral"),
      render: (r) =>
        r.category === "external" ? (
          <FinanceStatusBadge financeStatus={r.financeStatus} />
        ) : (
          <HrStatusBadge hrStatus={r.hrStatus} />
        ),
    },
    {
      key: "actions", header: "", className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="violations"
            recordId={r.id}
            title={`${t("violations.detailsTitle")}: ${r.employeeName}`}
            subtitle={t("violations.detailsSubtitle")}
            documentNo={r.documentNo ?? "MHS-IMS-PR-HSE-647"}
            fields={[
              { label: t("violations.fEmployeeName"), value: r.employeeName },
              { label: t("violations.fEmployeeNo"), value: r.employeeNo || "-" },
              { label: t("violations.fCompanyName"), value: r.companyName || "-" },
              { label: t("violations.fViolationType"), value: r.violationType || "-" },
              { label: t("violations.fCategory"), value: r.category ? categoryLabel(t, r.category) : "-" },
              { label: t("violations.fInternalAction"), value: r.internalAction || "-" },
              { label: t("violations.fDate"), value: r.violationDate ?? "-" },
              { label: t("violations.fTime"), value: r.violationTime || "-" },
              { label: t("violations.fPlace"), value: r.place || NOT_IN_SOURCE },
              { label: t("violations.fDetectedBy"), value: r.detectedBy || "-" },
              { label: t("violations.fDescription"), value: r.description || NOT_IN_SOURCE },
              { label: t("violations.fWitnesses"), value: r.witnesses || "-" },
              { label: t("violations.fProposedAction"), value: r.proposedAction || "-" },
              { label: t("violations.fStatus"), value: statusLabel(t, effectiveViolationStatus(r)) },
            ]}
            signatures={[
              { label: t("violations.sigViolator"), value: r.violatorSignature || "" },
              { label: t("violations.sigReporter"), value: r.editorSignature || "" },
              { label: t("violations.sigManager"), value: r.managerSignature || "" },
              // مربّعان إضافيان للمخالفات الآلية فقط (الناتجة عن الرصد الذكي):
              // توقيع المدقق الذي حوّل الرصد، وتوقيع موظف الموارد البشرية الذي أغلق
              // الحالة — يُسحبان للقراءة من القيم المحفوظة، و"" يعني لم يُوقَّع بعد.
              ...(aiSignatureInfo[r.id]
                ? [
                    { label: t("violations.sigAuditor"), value: aiSignatureInfo[r.id].auditor },
                    { label: t("violations.sigHrOfficer"), value: aiSignatureInfo[r.id].hrOfficer },
                  ]
                : []),
            ]}
            initialAttachments={[]}
            emailSender={emailSender}
            emailContext={{
              kind: "violation",
              number: r.documentNo || String(r.id),
              type: r.violationType || "",
              source: detectionSource(r),
              date: r.violationDate ?? "",
              time: r.violationTime || "",
              location: r.place || "",
              // لا يوجد حقل خطورة في سجل المخالفة؛ يُحذف سطره تلقائياً من الرسالة.
              classification: r.category ? categoryLabel(t, r.category) : "",
              status: statusLabel(t, effectiveViolationStatus(r)),
            }}
            extraSection={
              r.category === "external" ? (
                <FinanceClosureBlock
                  financeStatus={r.financeStatus}
                  settlementNumber={r.settlementNumber}
                  closedBy={r.financeClosedBy}
                  closedAt={r.financeClosedAt}
                  receiptUrl={r.paymentReceiptUrl}
                />
              ) : (
                <HrClosureBlock
                  hrStatus={r.hrStatus}
                  hrAction={r.hrAction}
                  hrActionDate={r.hrActionDate}
                  closedBy={r.hrClosedBy}
                  closedAt={r.hrClosedAt}
                  attachmentsRaw={r.hrAttachmentUrl}
                />
              )
            }
          />
          {isAdmin && <ViolationEditDialog violation={r} />}
          <DeleteButton id={r.id} action={handleDelete} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.violationsTitle")}
      subtitle={t("pageHeaders.violationsSubtitle")}
      user={user}
      action={
          <ViolationFormDialog
            employees={employees}
            initialEvidence={initialEvidence}
            initialDetectedBy={initialDetectedBy}
            autoOpen={autoOpen}
            violationTypes={violationTypeLabels}
          />
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t("violations.totalViolations")} value={violations.length} icon={FileWarning} tone="blue" />
        <KpiCard label={t("violations.openInProgress")} value={open} icon={Clock} tone="accent" />
        <KpiCard label={t("violations.closed")} value={closed} icon={CheckCircle2} tone="primary" />
      </div>
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("violations.registryTitle")}</h2>
        <DataTable columns={columns} rows={violations} emptyMessage={t("violations.emptyMessage")} />
      </div>
    </AppShell>
  )
}
