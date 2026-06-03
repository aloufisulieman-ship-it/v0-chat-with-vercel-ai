"use client"

import jsPDF from "jspdf"
import html2canvas from "html2canvas-pro"

// Renders a DOM element into a (possibly multi-page) A4 PDF and returns the jsPDF instance.
export async function elementToPdf(el: HTMLElement): Promise<jsPDF> {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  })

  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0
  const imgData = canvas.toDataURL("image/png")

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

export async function downloadElementPdf(el: HTMLElement, filename: string) {
  const pdf = await elementToPdf(el)
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`)
}
