// Migration 002 — add FOREIGN KEY constraints from every operational table's
// organizationId column to organization(id) with ON DELETE CASCADE.
//
// Application-layer scoping already isolates tenants; these constraints add
// DB-level referential integrity: an organizationId can never point at a
// non-existent organization, and deleting an organization cleans up its rows.
//
// Idempotent: each constraint is added only if it does not already exist.
// Transactional: all-or-nothing.

import pg from "pg"

const { Pool } = pg

const TABLES = [
  "company",
  "employees",
  "incident",
  "inspection",
  "permit",
  "risk",
  "training",
  "training_attendee",
  "toolbox_session",
  "toolbox_attendee",
  "corrective_action",
  "audit",
  "violation",
  "observation",
  "attachment",
  "document",
  "ai_detections",
  "ai_monitoring_notifications",
  "active_camera_streams",
  "video_recordings",
  "video_screenshots",
  "plate_reads",
  "employee_id_reads",
  "tuktuk_reads",
]

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    let added = 0
    for (const table of TABLES) {
      const constraint = `${table}_organizationId_fk`
      // Skip if a FK constraint with this name already exists.
      const exists = await client.query(
        `select 1 from pg_constraint where conname = $1 limit 1`,
        [constraint],
      )
      if (exists.rowCount > 0) {
        console.log(`  skip ${table} (constraint exists)`)
        continue
      }
      await client.query(
        `alter table public."${table}"
           add constraint "${constraint}"
           foreign key ("organizationId")
           references public."organization"("id")
           on delete cascade`,
      )
      console.log(`  + ${table}`)
      added += 1
    }
    await client.query("COMMIT")
    console.log(`Done. Added ${added} FK constraint(s).`)
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("Migration failed, rolled back:", err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
