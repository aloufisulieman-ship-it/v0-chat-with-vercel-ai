"use client"

import { useMemo } from "react"
import {
  MapPin,
  HardHat,
  UserCog,
  Users,
  Gauge,
  CalendarClock,
  Timer,
  UserRound,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  MinusCircle,
  FileText,
  Paperclip,
  ExternalLink,
  PenLine,
  History,
  Lock,
  Archive,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"
import { ImageLightbox, useLightbox, type LightboxImage } from "@/components/image-lightbox"
import { PermitRemainingBadge } from "@/components/permit-remaining-badge"
import { PermitLifecycleActions } from "@/components/permit-lifecycle-actions"
import type { PermitDetail } from "@/app/actions/permit-workflow"
import {
  checklistForType,
  getPermitType,
  GAS_FIELDS,
  normalizePermitStatus,
  permitStatusBadgeClass,
  permitStatusLabel,
  permitTypeLabel,
  type SignRole,
} from "@/lib/permit-workflow"
import { PERMIT_SIGNATORIES, SIGN_ROW_ISSUANCE, SIGN_ROW_CLOSURE } from "@/lib/permit-signatories"

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i
function isImage(a: { url: string; kind?: string }) {
  if (a.kind?.startsWith("image")) return true
  if (a.url.startsWith("data:image")) return true
  return IMAGE_RE.test(a.url.split("?")[0])
}

const RISK_BADGE: Record<string, string> = {
  low: "bg-success/10 text-success border-success/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  high: "bg-destructive/10 text-destructive border-destructive/30",
}

export function PermitDetailView({
  permit: p,
  isManager,
  onClose,
}: {
  permit: PermitDetail
  isManager: boolean
  onClose?: () => void
}) {
  const { t, locale, formatNumber } = useI18n()
  const loc = locale === "en" ? "en" : "ar"
  const { openLightbox, lightboxProps } = useLightbox()

  const st = normalizePermitStatus(p.status)
  const typeCfg = getPermitType(p.type)
  const readOnly = st === "closed" || st === "rejected" || Boolean(p.archivedAt)

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(loc === "en" ? "en-US" : "ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "—"

  const checklist = useMemo(() => checklistForType(p.type), [p.type])
  const compliance = useMemo(() => {
    if (checklist.length === 0) return { pct: 0, ok: 0, total: 0 }
    const ok = checklist.filter((it) => p.checklistAnswers[it.id] === true).length
    return { pct: Math.round((ok / checklist.length) * 100), ok, total: checklist.length }
  }, [checklist, p.checklistAnswers])

  const imageAttachments: LightboxImage[] = useMemo(
    () => p.attachments.filter(isImage).map((a) => ({ url: a.url, label: a.name })),
    [p.attachments],
  )
  const fileAttachments = useMemo(() => p.attachments.filter((a) => !isImage(a)), [p.attachments])

  const showGasLoto = typeCfg.requiresGasTest || typeCfg.requiresLOTO
  const loto = p.isolationLOTO as { points?: string; locks?: number | string; tags?: number | string }

  const signatureByRole = useMemo(() => {
    const map: Partial<Record<SignRole, PermitDetail["signatures"][number]>> = {}
    for (const s of p.signatures) if (!map[s.role as SignRole]) map[s.role as SignRole] = s
    return map
  }, [p.signatures])

  // بطاقة توقيع واحدة: المسمى الوظيفي + الاسم (تلقائي حسب الدور) + صورة التوقيع + التاريخ.
  const renderSig = (role: SignRole) => {
    const sig = signatureByRole[role]
    const cfg = PERMIT_SIGNATORIES[role]
    const displayName = sig?.signerName || cfg.name || "—"
    return (
      <div key={role} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
        <span className="text-xs font-medium text-muted-foreground">{loc === "ar" ? cfg.ar : cfg.en}</span>
        {sig && sig.signatureUrl ? (
          <>
            <div className="flex h-16 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sig.signatureUrl || "/placeholder.svg"} alt={displayName} crossOrigin="anonymous" className="max-h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{displayName}</span>
              <span className="text-[11px] text-muted-foreground" dir="ltr">
                {fmtDate(sig.signedAt)}
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
            {t("permitDetail.awaitingSignature")}
          </div>
        )}
      </div>
    )
  }

  return (
    <div dir={loc === "ar" ? "rtl" : "ltr"} className="flex flex-col gap-5 text-foreground">
      {/* شريط للقراءة فقط */}
      {readOnly && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          {p.archivedAt ? <Archive className="size-4" /> : <Lock className="size-4" />}
          {p.archivedAt ? t("permitDetail.roArchived") : t("permitDetail.roClosed")}
        </div>
      )}

      {/* 1) الرأس */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-sm text-muted-foreground" dir="ltr">
              {p.documentNo || `#${p.id}`}
            </span>
            <h2 className="text-xl font-bold text-balance">{p.title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {permitTypeLabel(p.type, loc)}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium",
                permitStatusBadgeClass(st),
              )}
            >
              {permitStatusLabel(st, loc)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Timer className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t("permitsReg.remaining")}:</span>
          <PermitRemainingBadge startAt={p.startAt} endAt={p.endAt} status={st} />
        </div>
      </div>

      {/* 2) البيانات الأساسية */}
      <Section icon={<FileText className="size-4" />} title={t("permitDetail.basics")}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field icon={<MapPin className="size-4" />} label={t("permitWizard.location")} value={p.location} />
          <Field icon={<HardHat className="size-4" />} label={t("permitWizard.contractor")} value={p.contractorName} />
          <Field icon={<UserCog className="size-4" />} label={t("permitWizard.supervisor")} value={p.supervisorName} />
          <Field
            icon={<Users className="size-4" />}
            label={t("permitWizard.workers")}
            value={p.workersCount != null ? formatNumber(p.workersCount) : null}
          />
          <div className="flex items-start gap-2">
            <Gauge className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{t("permitWizard.riskLevel")}</dt>
              <dd>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    RISK_BADGE[p.riskLevel ?? "medium"] ?? RISK_BADGE.medium,
                  )}
                >
                  {t(`permitWizard.risk${(p.riskLevel ?? "medium").charAt(0).toUpperCase()}${(p.riskLevel ?? "medium").slice(1)}`)}
                </span>
              </dd>
            </div>
          </div>
          <Field icon={<CalendarClock className="size-4" />} label={t("permitWizard.startAt")} value={fmtDate(p.startAt)} dir="ltr" />
          <Field icon={<CalendarClock className="size-4" />} label={t("permitWizard.endAt")} value={fmtDate(p.extendedTo ?? p.endAt)} dir="ltr" />
          <Field
            icon={<Timer className="size-4" />}
            label={t("permitDetail.duration")}
            value={p.durationHours != null ? `${formatNumber(p.durationHours)} ${t("permitDetail.hours")}` : null}
          />
          <Field icon={<UserRound className="size-4" />} label={t("permitWizard.requestedBy")} value={p.requestedBy} />
          <Field icon={<CalendarPlus className="size-4" />} label={t("permitDetail.createdAt")} value={fmtDate(p.createdAt)} dir="ltr" />
        </dl>
      </Section>

      {/* 3) وصف العمل */}
      {p.workDescription && (
        <Section icon={<FileText className="size-4" />} title={t("permitWizard.workDescription")}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{p.workDescription}</p>
        </Section>
      )}

      {/* 4) قائمة الفحص */}
      <Section
        icon={<CheckCircle2 className="size-4" />}
        title={t("permitWizard.checklist")}
        aside={
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {formatNumber(compliance.ok)}/{formatNumber(compliance.total)} · {formatNumber(compliance.pct)}%
          </span>
        }
      >
        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              compliance.pct >= 100 ? "bg-success" : compliance.pct >= 60 ? "bg-warning" : "bg-destructive",
            )}
            style={{ width: `${compliance.pct}%` }}
          />
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {checklist.map((it) => {
            const ans = p.checklistAnswers[it.id]
            const state = ans === true ? "ok" : ans === false ? "no" : "na"
            return (
              <li key={it.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-foreground">{loc === "ar" ? it.ar : it.en}</span>
                {state === "ok" && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                    <CheckCircle2 className="size-4" /> {t("permitDetail.compliant")}
                  </span>
                )}
                {state === "no" && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-destructive">
                    <XCircle className="size-4" /> {t("permitDetail.nonCompliant")}
                  </span>
                )}
                {state === "na" && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                    <MinusCircle className="size-4" /> {t("permitDetail.notApplicable")}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </Section>

      {/* 5) قياسات الغاز / العزل LOTO */}
      {showGasLoto && (
        <Section icon={<Gauge className="size-4" />} title={typeCfg.requiresGasTest ? t("permitWizard.gasTest") : t("permitWizard.loto")}>
          {typeCfg.requiresGasTest && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {GAS_FIELDS.map((g) => (
                <div key={g.id} className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3">
                  <span className="text-xs text-muted-foreground">{loc === "ar" ? g.ar : g.en}</span>
                  <span className="text-lg font-semibold tabular-nums" dir="ltr">
                    {p.gasTestReadings[g.id] ? `${p.gasTestReadings[g.id]} ${g.unit}` : "—"}
                  </span>
                  <span className="text-[10px] text-muted-foreground" dir="ltr">
                    {t("permitDetail.safeRange")}: {g.safe}
                  </span>
                </div>
              ))}
            </div>
          )}
          {typeCfg.requiresLOTO && (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t("permitWizard.lotoPoints")} value={loto?.points ? String(loto.points) : null} />
              <Field label={t("permitWizard.lotoLocks")} value={loto?.locks != null ? String(loto.locks) : null} />
              <Field label={t("permitWizard.lotoTags")} value={loto?.tags != null ? String(loto.tags) : null} />
            </dl>
          )}
        </Section>
      )}

      {/* 6) المرفقات */}
      {p.attachments.length > 0 && (
        <Section icon={<Paperclip className="size-4" />} title={t("permitWizard.attachments")}>
          {imageAttachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-3">
              {imageAttachments.map((img, i) => (
                <button
                  key={`${img.url}-${i}`}
                  type="button"
                  onClick={() => openLightbox(imageAttachments, i)}
                  className="size-24 overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-80"
                  aria-label={img.label || `${t("lightbox.image")} ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url || "/placeholder.svg"} alt={img.label || ""} crossOrigin="anonymous" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {fileAttachments.length > 0 && (
            <ul className="flex flex-col gap-2">
              {fileAttachments.map((a, i) => (
                <li key={`${a.url}-${i}`}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="size-4" />
                    {a.name || t("permitDetail.openFile")}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* 7) التواقيع الرسمية */}
      <Section icon={<PenLine className="size-4" />} title={t("permitDetail.signatures")}>
        <div className="flex flex-col gap-5">
          {/* الصف الأول — تواقيع الإصدار والاعتماد */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-muted-foreground">{t("permitDetail.rowIssuance")}</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SIGN_ROW_ISSUANCE.map((role) => renderSig(role))}
            </div>
          </div>
          {/* الصف الثاني — تواقيع الإغلاق */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-muted-foreground">{t("permitDetail.rowClosure")}</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SIGN_ROW_CLOSURE.map((role) => renderSig(role))}
            </div>
          </div>
        </div>
      </Section>

      {/* 8) سجل التتبع */}
      <Section icon={<History className="size-4" />} title={t("permitDetail.timeline")}>
        {p.auditLog.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("permitDetail.noEvents")}</p>
        ) : (
          <ol className="relative flex flex-col gap-4 border-s border-border ps-5">
            {p.auditLog.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -start-[27px] top-1 size-3 rounded-full border-2 border-background bg-primary" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{t(`permitDetail.action.${e.action}`)}</span>
                  {e.note && <span className="text-xs text-muted-foreground">{e.note}</span>}
                  <span className="text-[11px] text-muted-foreground">
                    {e.actorName || "—"} · <span dir="ltr">{fmtDate(e.createdAt)}</span>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* أزرار الإجراءات */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <PermitLifecycleActions
            permitId={p.id}
            documentNo={p.documentNo ?? `#${p.id}`}
            status={st}
            isManager={isManager}
            onPrint={() => window.print()}
            onDone={onClose}
          />
        </div>
      )}

      <ImageLightbox {...lightboxProps} />
    </div>
  )
}

function Section({
  icon,
  title,
  aside,
  children,
}: {
  icon: React.ReactNode
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Field({
  icon,
  label,
  value,
  dir,
}: {
  icon?: React.ReactNode
  label: string
  value: string | null | undefined
  dir?: "ltr" | "rtl"
}) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium text-foreground" dir={dir}>
          {value || "—"}
        </dd>
      </div>
    </div>
  )
}
