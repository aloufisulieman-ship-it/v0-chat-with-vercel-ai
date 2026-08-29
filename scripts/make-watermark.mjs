// سكربت لمرة واحدة: يحوّل أيقونة رقيب (خلفية بيضاء) إلى نسخة علامة مائية شفافة فعليًا
// عبر جعل البكسلات القريبة من الأبيض شفافة (alpha=0)، ليظهر الدرع فقط دون أي مربّع أبيض.
import sharp from "sharp"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const src = path.join(root, "public", "raqeeb-icon.png")
const out = path.join(root, "public", "raqeeb-watermark.png")

const img = sharp(src).ensureAlpha()
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
const { width, height, channels } = info

// عتبة الأبيض: أي بكسل قنواته الثلاث فوقها يُعتبر خلفية ويُصبح شفافًا تمامًا.
// نستخدم عتبة عالية (240) حتى لا نمسّ درجات الأخضر/الذهبي الفاتحة في الشعار.
const T = 240
for (let i = 0; i < data.length; i += channels) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  if (r >= T && g >= T && b >= T) {
    data[i + 3] = 0
  }
}

await sharp(data, { raw: { width, height, channels } })
  .png()
  .trim() // تقليم الهوامش الشفافة الزائدة حول الدرع
  .toFile(out)

console.log("[v0] wrote", out, `${width}x${height}`)
