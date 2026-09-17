"use client"

// Compresses an image File/Blob to a base64 JPEG, capped at maxDim on the
// longest side. Keeps payloads small enough to store in the DB and embed in PDF.
export async function compressImage(file: File | Blob, maxDim = 1200, quality = 0.7): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("تعذّر قراءة الملف"))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("تعذّر تحميل الصورة"))
    image.src = dataUrl
  })

  let { width, height } = img
  if (width > height && width > maxDim) {
    height = Math.round((height * maxDim) / width)
    width = maxDim
  } else if (height > maxDim) {
    width = Math.round((width * maxDim) / height)
    height = maxDim
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL("image/jpeg", quality)
}

// ───────────────────────── حدود الحجم الموحّدة للرفع ─────────────────────────
// الحدّ الأعلى لجسم أي Server Action هو 5MB (next.config.mjs → bodySizeLimit).
// نبقى تحته بهامش أمان: حدّ لكل ملف، وحدّ لمجموع مرفقات الطلب الواحد. الرسائل
// بالعربية وتُعرض للمستخدم كما هي عبر toast في كل نموذج.
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024
export const MAX_TOTAL_UPLOAD_BYTES = 4 * 1024 * 1024

// الحجم الفعلي بالبايت لمحتوى data URL بترميز base64 (بعد الفاصلة).
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",")
  if (comma < 0) return 0
  const b64 = dataUrl.slice(comma + 1)
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding)
}

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

export function uploadTooLargeMessage(fileName: string, bytes: number): string {
  const name = fileName?.trim() ? `«${fileName.trim()}» ` : ""
  return `الملف ${name}حجمه ${mb(bytes)} ميجابايت ويتجاوز الحد المسموح (${mb(MAX_UPLOAD_BYTES)} ميجابايت). اختر ملفاً أصغر أو اضغطه قبل الرفع.`
}

export function totalUploadTooLargeMessage(bytes: number): string {
  return `إجمالي حجم المرفقات ${mb(bytes)} ميجابايت ويتجاوز الحد المسموح (${mb(MAX_TOTAL_UPLOAD_BYTES)} ميجابايت) للطلب الواحد. احذف بعض المرفقات أو أرسلها على دفعات.`
}

// المسار الموحّد لتحويل أي ملف يختاره المستخدم إلى data URL جاهز للإرسال:
// الصور تُضغط دائماً (JPEG بأبعاد محدودة)، وغير الصور (PDF/مستندات) تُقرأ كما هي،
// ثم يُفرض حدّ الحجم على النتيجة مع رسالة عربية واضحة.
export async function fileToUploadDataUrl(
  file: File | Blob,
  opts?: { maxDim?: number; quality?: number },
): Promise<string> {
  const name = file instanceof File ? file.name : ""
  const isImage = file.type.startsWith("image/")
  const dataUrl = isImage
    ? await compressImage(file, opts?.maxDim ?? 1200, opts?.quality ?? 0.7)
    : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("تعذّر قراءة الملف"))
        reader.readAsDataURL(file)
      })

  const bytes = dataUrlBytes(dataUrl)
  if (bytes > MAX_UPLOAD_BYTES) throw new Error(uploadTooLargeMessage(name, bytes))
  return dataUrl
}

// نفس منطق fileToUploadDataUrl لكن للمسارات التي ترفع File عبر FormData بدل data URL.
export async function fileToUploadFile(file: File, opts?: { maxDim?: number; quality?: number }): Promise<File> {
  if (!file.type.startsWith("image/")) {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(uploadTooLargeMessage(file.name, file.size))
    return file
  }
  const dataUrl = await compressImage(file, opts?.maxDim ?? 1200, opts?.quality ?? 0.7)
  const bytes = dataUrlBytes(dataUrl)
  if (bytes > MAX_UPLOAD_BYTES) throw new Error(uploadTooLargeMessage(file.name, bytes))
  const blob = await (await fetch(dataUrl)).blob()
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" })
}

// يتحقق من مجموع حجم المرفقات المرسَلة في طلب واحد قبل استدعاء الـ Server Action.
export function assertTotalUploadSize(dataUrls: (string | null | undefined)[]): void {
  const total = dataUrls.reduce((sum, d) => sum + (d ? dataUrlBytes(d) : 0), 0)
  if (total > MAX_TOTAL_UPLOAD_BYTES) throw new Error(totalUploadTooLargeMessage(total))
}

// ضغط التواقيع: لوحة التوقيع تُنتج PNG شفافاً كبير الحجم نسبياً. نعيد رسمه على
// خلفية بيضاء بأبعاد محدودة ونصدّره JPEG — يبقى واضحاً في العرض والـ PDF بحجم أصغر.
export async function compressSignatureDataUrl(dataUrl: string, maxDim = 600): Promise<string> {
  if (!dataUrl.startsWith("data:image")) return dataUrl
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("تعذّر قراءة التوقيع"))
    image.src = dataUrl
  }).catch(() => null)
  if (!img) return dataUrl

  let { width, height } = img
  if (width <= 0 || height <= 0) return dataUrl
  const scale = Math.min(1, maxDim / Math.max(width, height))
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return dataUrl
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL("image/jpeg", 0.8)
}
