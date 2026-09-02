// Migration 005 — email provider preference + linked OAuth email accounts.
//
// 1) user.preferred_email_provider (nullable text): "microsoft" | "google" | "device" | "copy".
// 2) email_account: one row per (user, provider) holding AES-GCM-encrypted OAuth tokens
//    used to send reports directly from the user's own mailbox (Microsoft Graph / Gmail).
//
// Idempotent and transactional.

import pg from "pg"

const { Pool } = pg

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    await client.query(
      `alter table public."user" add column if not exists "preferred_email_provider" text`,
    )
    console.log("  + user.preferred_email_provider")

    await client.query(`
      create table if not exists public."email_account" (
        "id" text primary key,
        "userId" text not null references public."user"("id") on delete cascade,
        "provider" text not null,
        "emailAddress" text not null default '',
        "accessTokenEnc" text not null,
        "refreshTokenEnc" text,
        "accessTokenExpiresAt" timestamp,
        "scope" text,
        "createdAt" timestamp not null default now(),
        "updatedAt" timestamp not null default now()
      )
    `)
    await client.query(
      `create unique index if not exists "email_account_user_provider_idx"
         on public."email_account" ("userId", "provider")`,
    )
    console.log("  + email_account")

    await client.query("COMMIT")
    console.log("Done.")
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
