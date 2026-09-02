import "server-only"
import { put } from "@vercel/blob"
import { db } from "@/lib/db"
import { attachment } from "@/lib/db/schema"

// يحوّل data URL بترميز base64 إلى Blob.
export function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  const contentType = match[1]
  const bytes = Buffer.from(match[2], "base64")
  const ext = contentType.split("/")[1]?.split("+")[0] || "png"
  return { blob: new Blob([bytes], { type: contentType }), ext }
}

// يرفع data URL واحداً إلى Blob ويسجّله كمرفق مرتبط بسجل. يعيد رابط الملف أو undefined.
export async function saveDataUrlAttachment(
  userId: string,
  organizationId: string,
  module: string,
  recordId: number,
  kind: string,
  dataUrl: string,
  baseName: string,
): Promise<{ url: string; pathname: string } | undefined> {
  const parsed = dataUrlToBlob(dataUrl)
  if (!parsed) return undefined
  const filename = `${baseName}.${parsed.ext}`
  const key = `hse/${userId}/${module}/${recordId}/${Date.now()}-${filename}`
  // المتجر عام (public) كما في بقية مسارات الرفع؛ التحكم بالوصول على مستوى /api/file.
  const uploaded = await put(key, parsed.blob, { access: "public", addRandomSuffix: true })
  await db.insert(attachment).values({
    userId,
    organizationId,
    module,
    recordId,
    kind,
    pathname: uploaded.pathname,
    url: uploaded.url,
    filename,
    contentType: parsed.blob.type,
    size: parsed.blob.size,
  })
  return { url: uploaded.url, pathname: uploaded.pathname }
}
