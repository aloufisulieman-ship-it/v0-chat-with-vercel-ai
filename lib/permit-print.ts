// ================= قالب طباعة تصريح العمل (A4, RTL) =================
// مُنشئ HTML مشترك لطباعة التصريح كاملاً (زر الطباعة وأي مرفق PDF مستقبلاً يستخدم نفس القالب).
// التواقيع لها الأولوية القصوى ولا تُحذف أبداً. يُنتظر تحميل الصور والخطوط قبل الطباعة.
import QRCode from "qrcode"
import type { PermitDetail } from "@/app/actions/permit-workflow"
import {
  checklistForType,
  getPermitType,
  precautionsForType,
  GAS_FIELDS,
  normalizePermitStatus,
  permitStatusLabel,
  permitTypeLabel,
  type SignRole,
} from "@/lib/permit-workflow"
import { PERMIT_SIGNATORIES, SIGN_ROW_ISSUANCE, SIGN_ROW_CLOSURE } from "@/lib/permit-signatories"
import { formatMuscatDateTime } from "@/lib/datetime"

type Loc = "ar" | "en"
type TFn = (key: string) => string

// رقم المستند المُتحكَّم به للنموذج (ثابت) ورقم إصداره.
const DOC_REF = "MHS-IMS-FR-HSE-001"
const FORM_VERSION = "1"
const COMPANY_FALLBACK = { ar: "شركة الأيادي الفضية الحديثة", en: "Modern Silver Hands Co." }

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export interface PermitPrintOptions {
  t: TFn
  loc: Loc
  companyName?: string | null
}

// يبني نص HTML كامل للتصريح. مُصدَّر لإتاحة إعادة استخدامه (مثلاً لتوليد PDF).
export function buildPermitPrintHtml(permit: PermitDetail, opts: PermitPrintOptions & { qrDataUrl: string; origin: string }): string {
  const { t, loc, qrDataUrl, origin } = opts
  const rtl = loc === "ar"
  const company = (opts.companyName && opts.companyName.trim()) || (rtl ? COMPANY_FALLBACK.ar : COMPANY_FALLBACK.en)
  const st = normalizePermitStatus(permit.status)
  const typeCfg = getPermitType(permit.type)

  // فهرسة التواقيع حسب الدور دون تكرار.
  const sigByRole: Partial<Record<SignRole, PermitDetail["signatures"][number]>> = {}
  for (const s of permit.signatures) if (!sigByRole[s.role as SignRole]) sigByRole[s.role as SignRole] = s

  // قائمة الفحص ونسبة الامتثال.
  const checklist = checklistForType(permit.type)
  const okCount = checklist.filter((it) => permit.checklistAnswers[it.id] === true).length
  const compliance = checklist.length ? Math.round((okCount / checklist.length) * 100) : 0

  const riskKey = permit.riskLevel ?? "medium"
  const riskLabel = t(`permitWizard.risk${riskKey.charAt(0).toUpperCase()}${riskKey.slice(1)}`)

  const fieldRow = (label: string, value: string) =>
    `<tr><td class="k">${esc(label)}</td><td class="v">${esc(value)}</td></tr>`

  const basics = [
    fieldRow(t("permits.fPermitNo"), permit.documentNo || `#${permit.id}`),
    fieldRow(t("permitWizard.type"), permitTypeLabel(permit.type, loc)),
    fieldRow(t("permitWizard.workTitle"), permit.title),
    fieldRow(t("permitWizard.location"), permit.location || "—"),
    fieldRow(t("permitWizard.requestedBy"), permit.requestedBy || "—"),
    fieldRow(t("permitWizard.contractor"), permit.contractorName || "—"),
    fieldRow(t("permitWizard.supervisor"), permit.supervisorName || "—"),
    fieldRow(t("permitWizard.workers"), permit.workersCount != null ? String(permit.workersCount) : "—"),
    fieldRow(t("permitWizard.riskLevel"), riskLabel),
    fieldRow(t("permits.colStatus"), permitStatusLabel(st, loc)),
    fieldRow(t("permitWizard.startAt"), formatMuscatDateTime(permit.startAt, loc)),
    fieldRow(t("permitWizard.endAt"), formatMuscatDateTime(permit.extendedTo ?? permit.endAt, loc)),
    fieldRow(t("permitDetail.duration"), permit.durationHours != null ? `${permit.durationHours} ${t("permitDetail.hours")}` : "—"),
    fieldRow(t("permitDetail.createdAt"), formatMuscatDateTime(permit.createdAt, loc)),
  ].join("")

  // بنود قائمة الفحص بعلامات مطابق/غير مطابق/غير منطبق.
  const checklistRows = checklist
    .map((it) => {
      const ans = permit.checklistAnswers[it.id]
      const mark =
        ans === true
          ? `<span class="ok">✔ ${esc(t("permitDetail.compliant"))}</span>`
          : ans === false
            ? `<span class="no">✘ ${esc(t("permitDetail.nonCompliant"))}</span>`
            : `<span class="na">— ${esc(t("permitDetail.notApplicable"))}</span>`
      return `<tr><td class="ci">${esc(loc === "ar" ? it.ar : it.en)}</td><td class="cm">${mark}</td></tr>`
    })
    .join("")

  // الاحتياطات المطلوبة كنقاط.
  const precautions = precautionsForType(permit.type)
    .map((p) => `<li>${esc(loc === "ar" ? p.ar : p.en)}</li>`)
    .join("")

  // قياسات الغاز / العزل — تُطبع فقط للأنواع التي تتطلبها.
  let gasLotoBlock = ""
  if (typeCfg.requiresGasTest) {
    const cells = GAS_FIELDS.map((g) => {
      const val = permit.gasTestReadings[g.id]
      return `<div class="gas"><div class="gl">${esc(loc === "ar" ? g.ar : g.en)}</div><div class="gv">${val ? esc(`${val} ${g.unit}`) : "—"}</div><div class="gs">${esc(t("permitDetail.safeRange"))}: ${esc(g.safe)}</div></div>`
    }).join("")
    gasLotoBlock = `<section class="blk keep"><h2>${esc(t("permitWizard.gasTest"))}</h2><div class="gasgrid">${cells}</div></section>`
  } else if (typeCfg.requiresLOTO) {
    const loto = (permit.isolationLOTO || {}) as { points?: string; locks?: unknown; tags?: unknown }
    gasLotoBlock = `<section class="blk keep"><h2>${esc(t("permitWizard.loto"))}</h2><table class="kv"><tbody>
      ${fieldRow(t("permitWizard.lotoPoints"), loto.points ? String(loto.points) : "—")}
      ${fieldRow(t("permitWizard.lotoLocks"), loto.locks != null ? String(loto.locks) : "—")}
      ${fieldRow(t("permitWizard.lotoTags"), loto.tags != null ? String(loto.tags) : "—")}
    </tbody></table></section>`
  }

  // بطاقة توقيع واحدة (بصورة التوقيع أو "بانتظار التوقيع").
  const sigCell = (role: SignRole) => {
    const sig = sigByRole[role]
    const cfg = PERMIT_SIGNATORIES[role]
    const roleLabel = loc === "ar" ? cfg.ar : cfg.en
    const name = sig?.signerName || cfg.name || "—"
    if (sig?.signatureUrl) {
      return `<div class="sig"><div class="sr">${esc(roleLabel)}</div>
        <div class="simg"><img src="${esc(sig.signatureUrl)}" alt="" crossorigin="anonymous"/></div>
        <div class="sn">${esc(name)}</div>
        <div class="sd">${esc(formatMuscatDateTime(sig.signedAt, loc))}</div></div>`
    }
    return `<div class="sig pending"><div class="sr">${esc(roleLabel)}</div>
      <div class="sempty">${esc(t("permitDetail.awaitingSignature"))}</div>
      <div class="sn">${esc(name)}</div></div>`
  }

  const issuanceCells = SIGN_ROW_ISSUANCE.map(sigCell).join("")
  const closureCells = SIGN_ROW_CLOSURE.map(sigCell).join("")

  const printedAt = formatMuscatDateTime(new Date(), loc)
  const logoSrc = `${origin}/raqeeb-logo.png`

  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}" lang="${loc}">
<head><meta charset="utf-8"><title>${esc(permit.documentNo || permit.title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Tajawal:wght@400;500;700&display=swap');
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Cairo','Tajawal','Segoe UI',Tahoma,sans-serif; color: #0f172a; font-size: 11px; line-height: 1.5; padding-bottom: 20mm; }
  .hdr { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
  .hdr .logo { height: 54px; width: auto; object-fit: contain; }
  .hdr .titles { flex: 1; text-align: center; }
  .hdr .co { font-size: 13px; font-weight: 700; color: #1e3a8a; }
  .hdr .dept { font-size: 10px; color: #475569; margin-top: 1px; }
  .hdr .doc { font-size: 15px; font-weight: 700; margin-top: 4px; }
  .hdr .meta { font-size: 9px; color: #64748b; margin-top: 2px; }
  .hdr .qr { height: 68px; width: 68px; }
  .hdr .qrwrap { text-align: center; font-size: 7px; color: #94a3b8; }
  h2 { font-size: 12px; font-weight: 700; color: #1e3a8a; margin: 12px 0 5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
  .blk { margin-top: 6px; }
  .keep { break-inside: avoid; page-break-inside: avoid; }
  table.kv { width: 100%; border-collapse: collapse; }
  table.kv td { border: 1px solid #e2e8f0; padding: 4px 8px; vertical-align: top; }
  table.kv td.k { background: #f8fafc; font-weight: 600; color: #475569; width: 32%; }
  .desc { border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; white-space: pre-wrap; }
  table.chk { width: 100%; border-collapse: collapse; }
  table.chk td { border: 1px solid #e2e8f0; padding: 4px 8px; }
  table.chk td.cm { width: 30%; white-space: nowrap; }
  .ok { color: #15803d; font-weight: 600; } .no { color: #b91c1c; font-weight: 600; } .na { color: #64748b; }
  .cbar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin: 4px 0 2px; }
  .cbar > i { display: block; height: 100%; background: #1e3a8a; }
  .cpct { font-size: 9px; color: #475569; }
  ul.prec { margin: 4px 18px; padding: 0; } ul.prec li { margin-bottom: 2px; }
  .gasgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .gas { border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; text-align: center; }
  .gas .gl { font-size: 8px; color: #64748b; } .gas .gv { font-size: 13px; font-weight: 700; } .gas .gs { font-size: 7px; color: #94a3b8; }
  .sigrow { display: flex; gap: 6px; margin-bottom: 6px; }
  .sig { flex: 1; border: 1px solid #cbd5e1; border-radius: 5px; padding: 6px; text-align: center; min-height: 78px; }
  .sig.pending { border-style: dashed; }
  .sig .sr { font-size: 8px; color: #64748b; }
  .sig .simg { height: 40px; display: flex; align-items: center; justify-content: center; }
  .sig .simg img { max-height: 40px; max-width: 100%; object-fit: contain; }
  .sig .sempty { height: 40px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #94a3b8; }
  .sig .sn { font-size: 10px; font-weight: 700; margin-top: 2px; }
  .sig .sd { font-size: 8px; color: #64748b; direction: ltr; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; border-top: 1px solid #e2e8f0; padding-top: 4px; font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between; }
</style></head>
<body>
  <div class="hdr">
    <img class="logo" src="${esc(logoSrc)}" alt="" crossorigin="anonymous"/>
    <div class="titles">
      <div class="co">${esc(company)}</div>
      <div class="dept">${esc(t("permitPrint.companyDept"))}</div>
      <div class="doc">${esc(t("permitPrint.header"))}</div>
      <div class="meta">${esc(permit.documentNo || `#${permit.id}`)} · ${esc(DOC_REF)} · ${esc(t("permitPrint.version"))} ${FORM_VERSION}</div>
    </div>
    <div class="qrwrap"><img class="qr" src="${esc(qrDataUrl)}" alt=""/><div>${esc(t("permitPrint.scanToView"))}</div></div>
  </div>

  <section class="blk"><h2>${esc(t("permitDetail.basics"))}</h2><table class="kv"><tbody>${basics}</tbody></table></section>

  ${
    permit.workDescription
      ? `<section class="blk keep"><h2>${esc(t("permitPrint.workAndHazards"))}</h2><div class="desc">${esc(permit.workDescription)}</div></section>`
      : ""
  }

  <section class="blk keep"><h2>${esc(t("permitWizard.checklist"))}</h2>
    <div class="cbar"><i style="width:${compliance}%"></i></div>
    <div class="cpct">${okCount}/${checklist.length} · ${compliance}%</div>
    <table class="chk"><tbody>${checklistRows}</tbody></table>
  </section>

  <section class="blk keep"><h2>${esc(t("permitPrint.precautions"))}</h2><ul class="prec">${precautions}</ul></section>

  ${gasLotoBlock}

  <section class="blk keep"><h2>${esc(t("permitDetail.signatures"))}</h2>
    <div style="font-size:9px;color:#64748b;margin-bottom:3px">${esc(t("permitDetail.rowIssuance"))}</div>
    <div class="sigrow">${issuanceCells}</div>
    <div style="font-size:9px;color:#64748b;margin-bottom:3px">${esc(t("permitDetail.rowClosure"))}</div>
    <div class="sigrow">${closureCells}</div>
  </section>

  <div class="footer"><span>${esc(t("permitPrint.footer"))}</span><span>${esc(t("permitPrint.printedAt"))}: ${esc(printedAt)}</span></div>
</body></html>`
}

// ينتظر تحميل كل الصور والخطوط في نافذة الطباعة (مع مهلة احتياطية) ثم يطبع.
function waitForAssets(win: Window): Promise<void> {
  const imgs = Array.from(win.document.images)
  const imgPromises = imgs.map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.onload = () => resolve()
          img.onerror = () => resolve()
        }),
  )
  const fontsReady = (win.document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve()
  const all = Promise.all([...imgPromises, fontsReady as unknown as Promise<unknown>]).then(() => undefined)
  const timeout = new Promise<void>((resolve) => win.setTimeout(resolve, 4000))
  return Promise.race([all, timeout])
}

// يفتح نافذة الطباعة بالقالب الكامل. يولّد رمز QR ثم ينتظر الصور/الخطوط قبل الطباعة.
export async function openPermitPrint(permit: PermitDetail, opts: PermitPrintOptions): Promise<void> {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const permitUrl = `${origin}/permits/${permit.id}`
  let qrDataUrl = ""
  try {
    qrDataUrl = await QRCode.toDataURL(permitUrl, { margin: 1, width: 160, color: { dark: "#1e3a8a", light: "#ffffff" } })
  } catch {
    qrDataUrl = ""
  }

  const win = window.open("", "_blank", "width=880,height=1100")
  if (!win) return
  const html = buildPermitPrintHtml(permit, { ...opts, qrDataUrl, origin })
  win.document.open()
  win.document.write(html)
  win.document.close()
  await waitForAssets(win)
  win.focus()
  win.print()
}
