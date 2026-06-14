"use client"

import jsPDF from "jspdf"
import html2canvas from "html2canvas-pro"

// Renders a DOM element into an A4 PDF and returns the jsPDF instance.
// When `singlePage` is true, the entire content is scaled to fit one page
// (all data, photos and signatures stay together on a single page).
export async function elementToPdf(el: HTMLElement, opts?: { singlePage?: boolean }): Promise<jsPDF> {
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

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
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
