/**
 * Sets adapter_config.command to scripts/paperclip-claude.cmd for every claude_local agent.
 * Paperclip's PATH on Windows often omits %AppData%\Roaming\npm, so bare "claude" fails
 * even though `claude` works in PowerShell (PATHEXT + shell resolution).
 *
 * Requires local Paperclip embedded Postgres (default port 54329).
 *
 *   npm run paperclip:patch-claude
 *
 * Env:
 *   PAPERCLIP_DATABASE_URL  override (default postgres://paperclip:paperclip@127.0.0.1:54329/paperclip)
 *   PAPERCLIP_PG_PORT       port if not 54329
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const proxyCmd = path.resolve(repoRoot, 'scripts', 'paperclip-claude.cmd')

if (!fs.existsSync(proxyCmd)) {
  console.error('Expected proxy missing:', proxyCmd)
  process.exit(1)
}

const port = process.env.PAPERCLIP_PG_PORT || '54329'
const url =
  process.env.PAPERCLIP_DATABASE_URL ||
  `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`

const sql = postgres(url, { max: 1 })

try {
  const rows = await sql`
    UPDATE agents
    SET
      adapter_config = COALESCE(adapter_config, '{}'::jsonb) || ${sql.json({ command: proxyCmd })},
      updated_at = now()
    WHERE adapter_type = 'claude_local'
    RETURNING id::text, name
  `
  if (rows.length === 0) {
    console.log('No agents with adapter_type claude_local (nothing updated).')
  } else {
    console.log(`Updated ${rows.length} agent(s) to use Claude command:\n  ${proxyCmd}\n`)
    for (const r of rows) console.log(`  - ${r.name} (${r.id})`)
  }
} catch (e) {
  console.error(e.message || e)
  console.error(
    '\nHint: start Paperclip once so embedded Postgres is listening, or set PAPERCLIP_DATABASE_URL / PAPERCLIP_PG_PORT.'
  )
  process.exit(1)
} finally {
  await sql.end({ timeout: 2 })
}
