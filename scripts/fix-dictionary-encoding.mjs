// إصلاح تلف ترميز UTF-8 (أحرف U+FFFD) في ملفات القاموس.
// لكل سطر تالف يُستخرج المفتاح (مع مسار الكتلة الأب) ويُبحث في تاريخ git عن أول
// نسخة نظيفة لنفس المفتاح، وتُستبدل القيمة. يطبع المفاتيح التي لم يُعثر لها على بديل.
// الاستخدام: node scripts/fix-dictionary-encoding.mjs [--dry]
import { execSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"

const DRY = process.argv.includes("--dry")
const FILES = ["lib/i18n/dictionaries/ar.ts", "lib/i18n/dictionaries/en.ts"]
const BAD = "\uFFFD"

// يبني خريطة: "block.key" -> نص السطر، مع تتبّع الكتل المتداخلة عبر الأقواس.
function indexLines(src) {
  const map = new Map()
  const stack = []
  const lines = src.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const open = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*\{\s*$/)
    const kv = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*(["'`])/)
    if (open) {
      stack.push(open[1])
      continue
    }
    if (kv) {
      map.set([...stack, kv[1]].join("."), { line, idx: i })
    }
    // إغلاق كتلة (سطر يبدأ بـ } )
    if (/^\s*\},?\s*$/.test(line) && stack.length) stack.pop()
  }
  return { map, lines }
}

function gitRevisions(file) {
  return execSync(`git log --format=%h -80 -- ${file}`, { encoding: "utf8" }).trim().split("\n").filter(Boolean)
}

for (const file of FILES) {
  const src = readFileSync(file, "utf8")
  const { map, lines } = indexLines(src)
  const badKeys = [...map.entries()].filter(([, v]) => v.line.includes(BAD))
  const badLinesNoKey = lines.filter((l) => l.includes(BAD)).length - badKeys.length
  console.log(`\n${file}: ${badKeys.length} corrupted keyed lines, ${badLinesNoKey} corrupted non-keyed lines`)
  if (!badKeys.length) continue

  const revs = gitRevisions(file)
  const cache = new Map()
  const unresolved = []
  for (const [key, { idx }] of badKeys) {
    let fixed = null
    for (const rev of revs) {
      if (!cache.has(rev)) {
        try {
          cache.set(rev, indexLines(execSync(`git show ${rev}:${file}`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })).map)
        } catch {
          cache.set(rev, new Map())
        }
      }
      const hit = cache.get(rev).get(key)
      if (hit && !hit.line.includes(BAD)) {
        fixed = hit.line
        break
      }
    }
    if (fixed) {
      // نحافظ على المسافة البادئة الحالية.
      const indent = lines[idx].match(/^\s*/)[0]
      lines[idx] = indent + fixed.trimStart()
    } else {
      unresolved.push({ key, line: lines[idx].trim() })
    }
  }
  console.log(`  fixed: ${badKeys.length - unresolved.length}, unresolved: ${unresolved.length}`)
  for (const u of unresolved) console.log(`  UNRESOLVED ${u.key}: ${u.line}`)
  if (!DRY) writeFileSync(file, lines.join("\n"), "utf8")
}
