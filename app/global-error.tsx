"use client"

import { useEffect } from "react"

// حدّ الخطأ الجذري: يُستخدم فقط إذا فشل التخطيط الجذري نفسه (root layout). يجب أن
// يعرّف عنصري html/body لأنه يحل محل التخطيط الجذري عند التفعيل.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] Global error boundary:", error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            تعذّر تحميل التطبيق
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
            حدث خطأ غير متوقع. يُرجى إعادة المحاولة.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  )
}
