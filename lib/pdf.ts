"use client"

import jsPDF from "jspdf"
import html2canvas from "html2canvas-pro"

// Waits until every <img> inside `el` has finished loading/decoding. Base64
// data-URL images attached to a freshly-built DOM node are NOT guaranteed to be
// decoded synchronously; rasterizing before they finish produces blank images
// (this is why signatures/photos were missing from the exported PDF).
async function waitForImages(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll("img"))
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          const done = () => resolve()
          if (img.complete && img.naturalWidth > 0) {
            img.decode().then(done, done)
            return
          }
          img.addEventListener("load", () => img.decode().then(done, done), { once: true })
          img.addEventListener("error", done, { once: true })
        }),
    ),
  )
  // One extra frame so layout settles after images report their size.
  await new Promise((r) => requestAnimationFrame(() => r(null)))
}

// Renders a DOM element into an A4 PDF and returns the jsPDF instance.
// When `singlePage` is true, the entire content is scaled to fit one page
// (all data, photos and signatures stay together on a single page).
export async function elementToPdf(el: HTMLElement, opts?: { singlePage?: boolean }): Promise<jsPDF> {
  // Ensure all base64 signatures/photos are decoded before rasterizing.
  await waitForImages(el)

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  })

  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgData = canvas.toDataURL("image/png")

  if (opts?.singlePage) {
    // Fit the whole content onto a single page, preserving aspect ratio.
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
    const imgWidth = canvas.width * ratio
    const imgHeight = canvas.height * ratio
    const x = (pageWidth - imgWidth) / 2
    pdf.addImage(imgData, "PNG", x, 0, imgWidth, imgHeight)
    return pdf
  }

  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  // If the whole content fits within one page (with a small tolerance), render
  // it once — prevents a trailing near-empty page from rounding.
  const TOLERANCE = 2 // mm
  if (imgHeight <= pageHeight + TOLERANCE) {
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight)
    return pdf
  }

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > TOLERANCE) {
    position -= pageHeight
    pdf.addPage()
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  return pdf
}

export async function downloadElementPdf(
  el: HTMLElement,
  filename: string,
  opts?: { singlePage?: boolean },
) {
  const pdf = await elementToPdf(el, opts)
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`)
}
