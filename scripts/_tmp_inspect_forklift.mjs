import { read, utils } from "xlsx"
import { readFileSync } from "node:fs"

const buf = readFileSync("data/All-Forklift-c84871.xlsx")
const wb = read(buf, { cellDates: true })
console.log("[v0] SheetNames:", wb.SheetNames)

for (const name of wb.SheetNames) {
  const rows = utils.sheet_to_json(wb.Sheets[name], { defval: null })
  console.log(`\n[v0] === Sheet "${name}" — ${rows.length} rows ===`)
  if (rows.length) {
    console.log("[v0] Headers:", Object.keys(rows[0]))
    console.log("[v0] Sample rows:", JSON.stringify(rows.slice(0, 6), null, 2))
    console.log("[v0] Last row:", JSON.stringify(rows[rows.length - 1], null, 2))
  }
}
