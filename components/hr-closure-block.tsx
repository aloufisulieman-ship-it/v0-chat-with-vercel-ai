"use client"

import { FileText, ZoomIn } from "lucide-react"
import { HrStatusBadge } from "@/components/hr-status-badge"
import { normalizeHrStatus, parseHrAttachments } from "@/lib/hr-status"
import { useI18n } from "@/lib/i18n/client"
import { ImageLightbox, useLightbox, type LightboxImage } from "@/components/image-lightbox"

/**
 * كتلة تفاصيل معالجة الموارد البشرية داخل نافذة تفاصيل السجل — تظهر لجميع المستخدمين.
 * عند الإغلاق تعرض تاريخ الإغلاق ومن أغلق والإجراء المتخذ ومعاينة/رابط المرفقات.
 */
export function HrClosureBlock({
  hrStatus,
  hrAction,
  hrActionDate,
  closedBy,
  closedAt,
  attachmentsRaw,
}: {
  hrStatus: string | null | undefined
  hrAction: string | null | undefined
  hrActionDate: string | null | undefined
  closedBy: string | null | undefined
  closedAt: Date | string | null | undefined
  attachmentsRaw: string | null | undefined
}) {
  const { t, formatDateTime } = useI18n()
  const status = normalizeHrStatus(hrStatus)
  const isClosed = status === "closed"
  const attachments = parseHrAttachments(attachmentsRaw)
  // منسّق مركزي بمنطقة زمنية ثابتة لتجنّب عدم تطابق الترطيب بين الخادم والعميل.
  const closedAtStr = closedAt ? formatDateTime(new Date(closedAt)) : ""

  // معاينة صور مرفقات الموارد البشرية عبر نفس مكوّن ImageLightbox.
  const { openLightbox, lightboxProps } = useLightbox()
  const galleryImages: LightboxImage[] = attachments
    .filter((a) => a.startsWith("data:image"))
    .map((a) => ({ url: a, label: t("lightbox.sourceHr") }))
  const galleryIndexOf = (url: string) => galleryImages.findIndex((g) => g.url === url)

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{t("closureBlock.hrTitle")}</h4>
        <HrStatusBadge hrStatus={hrStatus} />
      </div>

      {isClosed ? (
        <dl className="flex flex-col gap-1.5 text-sm">
          {closedAtStr && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{t("closureBlock.closedDate")}</dt>
              <dd className="text-foreground">{closedAtStr}</dd>
            </div>
          )}
          {closedBy && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{t("closureBlock.closedBy")}</dt>
              <dd className="text-foreground">{closedBy}</dd>
            </div>
          )}
          {hrActionDate && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{t("closureBlock.actionDate")}</dt>
              <dd className="text-foreground" dir="ltr">{hrActionDate}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("closureBlock.actionTaken")}</dt>
            <dd className="whitespace-pre-line text-foreground">{hrAction || "-"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("closureBlock.hrPendingNote")}
        </p>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("closureBlock.attachments")} ({attachments.length})</span>
          <div className="flex flex-wrap gap-2">
            {attachments.map((a, i) =>
              a.startsWith("data:image") ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => openLightbox(galleryImages, galleryIndexOf(a))}
                  className="group relative size-20 cursor-pointer overflow-hidden rounded border border-border transition-colors hover:border-primary"
                  aria-label={t("closureBlock.attachmentAlt")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a || "/placeholder.svg"}
                    alt={`${t("closureBlock.attachmentAlt")} ${i + 1}`}
                    className="size-full object-cover transition-opacity group-hover:opacity-80"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <ZoomIn className="size-5 text-white" />
                  </span>
                </button>
              ) : (
                <a
                  key={i}
                  href={a}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded border border-border bg-muted/40 text-[10px] text-muted-foreground hover:bg-muted"
                >
                  <FileText className="size-6" />
                  {t("closureBlock.downloadFile")}
                </a>
              ),
            )}
          </div>
        </div>
      )}

      <ImageLightbox {...lightboxProps} />
    </section>
  )
}
