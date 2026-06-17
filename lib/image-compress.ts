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
