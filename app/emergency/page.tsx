import { Siren, ShieldAlert, CalendarClock, CircleCheck, Users, Wrench, Radio } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { DeleteButton } from "@/components/delete-button"
import { IsoClauseBadge } from "@/components/iso-clause-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireModule } from "@/lib/session"
import {
  getEmergencyPlans,
  getEmergencyContacts,
  getEmergencyEquipment,
  getEmergencyDrills,
  getEmergencyActivations,
  getEmergencyStats,
  createEmergencyPlan,
  deleteEmergencyPlan,
  createEmergencyContact,
  deleteEmergencyContact,
  createEmergencyEquipment,
  deleteEmergencyEquipment,
  deleteEmergencyDrill,
  createEmergencyActivation,
  deleteEmergencyActivation,
  getCompany,
} from "@/app/actions/hse"
import {
  PlanApproveDialog,
  PlanPdfButton,
  ConvertIncidentButton,
  DrillCreateDialog,
  type PlanLite,
} from "@/components/emergency/emergency-actions"
import { getServerT } from "@/lib/i18n/server"

type Plan = Awaited<ReturnType<typeof getEmergencyPlans>>[number]
type Contact = Awaited<ReturnType<typeof getEmergencyContacts>>[number]
type Equip = Awaited<ReturnType<typeof getEmergencyEquipment>>[number]
type Drill = Awaited<ReturnType<typeof getEmergencyDrills>>[number]
type Activation = Awaited<ReturnType<typeof getEmergencyActivations>>[number]

export default async function EmergencyPage() {
  const user = await requireModule("emergency")
  const [plans, contacts, equipment, drills, activations, stats, company] = await Promise.all([
    getEmergencyPlans(),
    getEmergencyContacts(),
    getEmergencyEquipment(),
    getEmergencyDrills(),
    getEmergencyActivations(),
    getEmergencyStats(),
    getCompany().catch(() => null),
  ])
  const { t, locale } = await getServerT()
  const orgName = company?.name || "MHS"

  const typeOptions = [
    { value: "fire", label: t("emergencyMod.typeFire") },
    { value: "chemical", label: t("emergencyMod.typeChemical") },
    { value: "medical", label: t("emergencyMod.typeMedical") },
    { value: "evacuation", label: t("emergencyMod.typeEvacuation") },
    { value: "natural", label: t("emergencyMod.typeNatural") },
  ]
  const severityOptions = [
    { value: "low", label: t("emergencyMod.sevLow") },
    { value: "medium", label: t("emergencyMod.sevMedium") },
    { value: "high", label: t("emergencyMod.sevHigh") },
    { value: "critical", label: t("emergencyMod.sevCritical") },
  ]
  const typeLabel = (v: string) => typeOptions.find((o) => o.value === v)?.label ?? v
  const severityLabel = (v: string) => severityOptions.find((o) => o.value === v)?.label ?? v
  const statusLabelStr = (v: string) =>
    ({
      draft: t("emergencyMod.statusDraft"),
      under_review: t("emergencyMod.statusNeedsReview"),
      approved: t("emergencyMod.statusApproved"),
    })[v] ?? v

  // ----- نموذج الخطة -----
  const planFields: FieldDef[] = [
    { name: "scenario", label: t("emergencyMod.fScenario"), required: true, full: true, placeholder: t("emergencyMod.fScenarioPlaceholder") },
    { name: "planType", label: t("emergencyMod.fType"), type: "select", options: typeOptions },
    { name: "severity", label: t("emergencyMod.fSeverity"), type: "select", options: severityOptions },
    { name: "location", label: t("emergencyMod.fLocation") },
    { name: "responsibleTeam", label: t("emergencyMod.fTeam"), placeholder: t("emergencyMod.fTeamPlaceholder") },
    { name: "assemblyPoint", label: t("emergencyMod.fAssembly") },
    { name: "reviewDate", label: t("emergencyMod.fReview"), type: "date" },
    { name: "triggerCriteria", label: t("emergencyMod.fTrigger"), type: "textarea" },
    { name: "responseSteps", label: t("emergencyMod.fSteps"), type: "textarea", full: true, placeholder: t("emergencyMod.linesPlaceholder") },
    { name: "roles", label: t("emergencyMod.fRoles"), type: "textarea", full: true, placeholder: t("emergencyMod.linesPlaceholder") },
  ]

  const planColumns: Column<Plan>[] = [
    { key: "planNo", header: t("emergencyMod.colPlanNo"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.planNo || "-"}</span> },
    { key: "scenario", header: t("emergencyMod.fScenario"), render: (r) => <span className="font-medium text-foreground">{r.scenario}</span> },
    {
      key: "planType",
      header: t("emergencyMod.fType"),
      render: (r) => (
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
          {typeLabel(r.planType)}
        </span>
      ),
    },
    { key: "severity", header: t("emergencyMod.fSeverity"), render: (r) => <span className="text-muted-foreground">{severityLabel(r.severity)}</span> },
    { key: "responsibleTeam", header: t("emergencyMod.fTeam"), render: (r) => <span className="text-muted-foreground">{r.responsibleTeam || "-"}</span> },
    { key: "status", header: t("emergencyMod.fStatus"), render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <PlanPdfButton
            plan={r as unknown as PlanLite}
            orgName={orgName}
            typeLabel={typeLabel(r.planType)}
            severityLabel={severityLabel(r.severity)}
            statusLabel={statusLabelStr(r.status)}
          />
          <PlanApproveDialog plan={r as unknown as PlanLite} />
          <DeleteButton id={r.id} action={deleteEmergencyPlan} />
        </div>
      ),
    },
  ]

  // ----- نموذج جهات الاتصال -----
  const contactTypeOptions = [
    { value: "internal", label: t("emergencyMod.ctInternal") },
    { value: "external", label: t("emergencyMod.ctExternal") },
  ]
  const contactFields: FieldDef[] = [
    { name: "name", label: t("emergencyMod.fContactName"), required: true, full: true },
    { name: "phone", label: t("emergencyMod.fPhone") },
    { name: "contactType", label: t("emergencyMod.fContactType"), type: "select", options: contactTypeOptions },
    { name: "role", label: t("emergencyMod.fContactRole") },
    { name: "available247", label: t("emergencyMod.f247"), type: "select", options: [
      { value: "false", label: t("emergencyMod.no") },
      { value: "true", label: t("emergencyMod.yes") },
    ] },
    { name: "notes", label: t("emergencyMod.fNotes"), type: "textarea", full: true },
  ]
  const contactColumns: Column<Contact>[] = [
    { key: "name", header: t("emergencyMod.fContactName"), render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    { key: "phone", header: t("emergencyMod.fPhone"), render: (r) => <span className="font-mono text-sm" dir="ltr">{r.phone || "-"}</span> },
    {
      key: "contactType",
      header: t("emergencyMod.fContactType"),
      render: (r) => (
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {r.contactType === "internal" ? t("emergencyMod.ctInternal") : t("emergencyMod.ctExternal")}
        </span>
      ),
    },
    { key: "role", header: t("emergencyMod.fContactRole"), render: (r) => <span className="text-muted-foreground">{r.role || "-"}</span> },
    { key: "available247", header: t("emergencyMod.f247"), render: (r) => <span className="text-muted-foreground">{r.available247 ? t("emergencyMod.yes") : t("emergencyMod.no")}</span> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end">
          <DeleteButton id={r.id} action={deleteEmergencyContact} />
        </div>
      ),
    },
  ]

  // ----- نموذج المعدات -----
  const equipTypeOptions = [
    { value: "extinguisher", label: t("emergencyMod.eqExtinguisher") },
    { value: "hydrant", label: t("emergencyMod.eqHydrant") },
    { value: "alarm", label: t("emergencyMod.eqAlarm") },
    { value: "first_aid", label: t("emergencyMod.eqFirstAid") },
    { value: "exit", label: t("emergencyMod.eqExit") },
    { value: "other", label: t("emergencyMod.eqOther") },
  ]
  const equipStatusOptions = [
    { value: "ready", label: t("emergencyMod.eqReady") },
    { value: "maintenance", label: t("emergencyMod.eqMaintenance") },
    { value: "expired", label: t("emergencyMod.eqExpired") },
  ]
  const equipFields: FieldDef[] = [
    { name: "equipType", label: t("emergencyMod.fEquipType"), type: "select", options: equipTypeOptions },
    { name: "code", label: t("emergencyMod.fCode") },
    { name: "location", label: t("emergencyMod.fLocation"), full: true },
    { name: "lastCheckDate", label: t("emergencyMod.fLastCheck"), type: "date" },
    { name: "nextCheckDate", label: t("emergencyMod.fNextCheck"), type: "date" },
    { name: "status", label: t("emergencyMod.fStatus"), type: "select", options: equipStatusOptions },
    { name: "notes", label: t("emergencyMod.fNotes"), type: "textarea", full: true },
  ]
  const today = new Date().toISOString().slice(0, 10)
  const equipColumns: Column<Equip>[] = [
    { key: "equipType", header: t("emergencyMod.fEquipType"), render: (r) => <span className="font-medium text-foreground">{equipTypeOptions.find((o) => o.value === r.equipType)?.label ?? r.equipType}</span> },
    { key: "code", header: t("emergencyMod.fCode"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.code || "-"}</span> },
    { key: "location", header: t("emergencyMod.fLocation"), render: (r) => <span className="text-muted-foreground">{r.location || "-"}</span> },
    {
      key: "nextCheckDate",
      header: t("emergencyMod.fNextCheck"),
      render: (r) => {
        const overdue = r.nextCheckDate && (r.nextCheckDate as unknown as string) < today
        return <span className={`font-mono text-xs ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`} dir="ltr">{(r.nextCheckDate as unknown as string) ?? "-"}</span>
      },
    },
    { key: "status", header: t("emergencyMod.fStatus"), render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end">
          <DeleteButton id={r.id} action={deleteEmergencyEquipment} />
        </div>
      ),
    },
  ]

  // ----- التمارين -----
  const drillColumns: Column<Drill>[] = [
    { key: "drillNo", header: t("emergencyMod.colDrillNo"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.drillNo || "-"}</span> },
    { key: "drillDate", header: t("emergencyMod.fDrillDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{(r.drillDate as unknown as string) ?? "-"}</span> },
    {
      key: "drillType",
      header: t("emergencyMod.fDrillType"),
      render: (r) => (
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {({ evacuation: t("emergencyMod.drillEvacuation"), fire: t("emergencyMod.drillFire"), medical: t("emergencyMod.drillMedical"), spill: t("emergencyMod.drillSpill") } as Record<string, string>)[r.drillType] ?? r.drillType}
        </span>
      ),
    },
    { key: "participants", header: t("emergencyMod.fParticipants"), render: (r) => <span className="text-muted-foreground" dir="ltr">{r.participants}</span> },
    { key: "evacuationMinutes", header: t("emergencyMod.fEvacMinutes"), render: (r) => <span className="text-muted-foreground" dir="ltr">{r.evacuationMinutes}</span> },
    { key: "outcome", header: t("emergencyMod.fOutcome"), render: (r) => <span className="text-muted-foreground line-clamp-1 max-w-xs">{r.outcome || "-"}</span> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end">
          <DeleteButton id={r.id} action={deleteEmergencyDrill} />
        </div>
      ),
    },
  ]

  // ----- البلاغات -----
  const activationFields: FieldDef[] = [
    { name: "scenario", label: t("emergencyMod.fScenario"), required: true, full: true },
    { name: "reportedAt", label: t("emergencyMod.fReportedAt"), type: "text", placeholder: "YYYY-MM-DDTHH:mm" },
    { name: "arrivedAt", label: t("emergencyMod.fArrivedAt"), type: "text", placeholder: "YYYY-MM-DDTHH:mm" },
    { name: "closedAt", label: t("emergencyMod.fClosedAt"), type: "text", placeholder: "YYYY-MM-DDTHH:mm" },
    { name: "outcome", label: t("emergencyMod.fOutcome") },
    { name: "description", label: t("emergencyMod.fDescription"), type: "textarea", full: true },
  ]
  const activationColumns: Column<Activation>[] = [
    { key: "activationNo", header: t("emergencyMod.colActNo"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.activationNo || "-"}</span> },
    { key: "scenario", header: t("emergencyMod.fScenario"), render: (r) => <span className="font-medium text-foreground">{r.scenario}</span> },
    { key: "reportedAt", header: t("emergencyMod.fReportedAt"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.reportedAt ? new Date(r.reportedAt).toLocaleString("en-GB", { hour12: false }) : "-"}</span> },
    {
      key: "closedAt",
      header: t("emergencyMod.fStatus"),
      render: (r) => <StatusBadge status={r.closedAt ? "closed" : "open"} />,
    },
    { key: "outcome", header: t("emergencyMod.fOutcome"), render: (r) => <span className="text-muted-foreground line-clamp-1 max-w-xs">{r.outcome || "-"}</span> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <ConvertIncidentButton id={r.id} converted={Boolean(r.convertedIncidentId)} />
          <DeleteButton id={r.id} action={deleteEmergencyActivation} />
        </div>
      ),
    },
  ]

  const planOptions = plans.map((p) => ({ id: p.id, scenario: p.scenario, planNo: p.planNo || "" }))

  return (
    <AppShell
      title={t("pageHeaders.emergencyTitle")}
      subtitle={t("pageHeaders.emergencySubtitle")}
      user={user}
    >
      <IsoClauseBadge ids={["8.2"]} locale={locale} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("emergencyMod.kpiPlans")} value={stats.plansTotal} icon={Siren} tone="blue" />
        <KpiCard label={t("emergencyMod.kpiApproved")} value={stats.plansApproved} icon={CircleCheck} tone="primary" />
        <KpiCard label={t("emergencyMod.kpiEquipDue")} value={stats.equipmentDue} icon={CalendarClock} tone="destructive" />
        <KpiCard label={t("emergencyMod.kpiActivationsOpen")} value={stats.activationsOpen} icon={ShieldAlert} tone="accent" />
      </div>

      <div className="mt-6">
        <Tabs defaultValue="plans">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="plans" className="gap-2"><Siren className="size-4" />{t("emergencyMod.tabPlans")}</TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2"><Users className="size-4" />{t("emergencyMod.tabContacts")}</TabsTrigger>
            <TabsTrigger value="equipment" className="gap-2"><Wrench className="size-4" />{t("emergencyMod.tabEquipment")}</TabsTrigger>
            <TabsTrigger value="drills" className="gap-2"><CalendarClock className="size-4" />{t("emergencyMod.tabDrills")}</TabsTrigger>
            <TabsTrigger value="activations" className="gap-2"><Radio className="size-4" />{t("emergencyMod.tabActivations")}</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("emergencyMod.registryTitle")}</h2>
              <RecordDialog title={t("emergencyMod.dialogTitle")} description={t("emergencyMod.dialogDesc")} triggerLabel={t("emergencyMod.trigger")} fields={planFields} action={createEmergencyPlan} />
            </div>
            <DataTable columns={planColumns} rows={plans} emptyMessage={t("emergencyMod.emptyMessage")} />
          </TabsContent>

          <TabsContent value="contacts" className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("emergencyMod.contactsTitle")}</h2>
              <RecordDialog title={t("emergencyMod.contactDialogTitle")} triggerLabel={t("emergencyMod.addContact")} fields={contactFields} action={createEmergencyContact} />
            </div>
            <DataTable columns={contactColumns} rows={contacts} emptyMessage={t("emergencyMod.contactsEmpty")} />
          </TabsContent>

          <TabsContent value="equipment" className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("emergencyMod.equipmentTitle")}</h2>
              <RecordDialog title={t("emergencyMod.equipDialogTitle")} triggerLabel={t("emergencyMod.addEquipment")} fields={equipFields} action={createEmergencyEquipment} />
            </div>
            <DataTable columns={equipColumns} rows={equipment} emptyMessage={t("emergencyMod.equipmentEmpty")} />
          </TabsContent>

          <TabsContent value="drills" className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("emergencyMod.drillsTitle")}</h2>
              <DrillCreateDialog plans={planOptions} />
            </div>
            <DataTable columns={drillColumns} rows={drills} emptyMessage={t("emergencyMod.drillsEmpty")} />
          </TabsContent>

          <TabsContent value="activations" className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("emergencyMod.activationsTitle")}</h2>
              <RecordDialog title={t("emergencyMod.actDialogTitle")} description={t("emergencyMod.actDialogDesc")} triggerLabel={t("emergencyMod.addActivation")} fields={activationFields} action={createEmergencyActivation} />
            </div>
            <DataTable columns={activationColumns} rows={activations} emptyMessage={t("emergencyMod.activationsEmpty")} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
