import "server-only"
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

// تشفير/فك تشفير رموز OAuth بـ AES-256-GCM. المفتاح من ENCRYPTION_KEY (32 بايت base64).
// الصيغة المخزَّنة: base64(iv[12] || tag[16] || ciphertext).

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error("ENCRYPTION_KEY غير مُعدّ")
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY يجب أن يكون 32 بايت مُرمَّزاً base64 (openssl rand -base64 32)")
  return key
}

export function encryptSecret(plain: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64")
}

export function decryptSecret(stored: string): string {
  const key = getKey()
  const buf = Buffer.from(stored, "base64")
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
}
