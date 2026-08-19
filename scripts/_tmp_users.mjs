import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)
const rows = await sql`select email, name, role from "user" order by "createdAt" limit 10`
console.log(JSON.stringify(rows, null, 2))
