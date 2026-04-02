/**
 * Launches `npx paperclipai run` with the npm global bin dir prepended to PATH.
 * Fixes: Command not found in PATH: "claude" when the Paperclip server inherits
 * a minimal PATH (e.g. GUI launchers, services) that omits %AppData%\Roaming\npm.
 *
 * Usage: node scripts/run-paperclip.mjs
 *        npm run paperclip
 *
 * If runs still fail with EPERM on symlinks under .claude/skills, enable Windows
 * Developer Mode: Settings → Privacy & Security → For developers → Developer Mode.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { existsSync } from 'node:fs'

function withGlobalNpmOnPath(env) {
  const cur = env.Path || env.PATH || ''
  const dirs = []
  if (os.platform() === 'win32') {
    dirs.push(path.join(os.homedir(), 'AppData', 'Roaming', 'npm'))
  } else {
    for (const d of ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local', 'bin')]) {
      dirs.push(d)
    }
  }
  const prefix = dirs.filter((d) => existsSync(d)).join(path.delimiter)
  const next = prefix ? `${prefix}${path.delimiter}${cur}` : cur
  return { ...env, Path: next, PATH: next }
}

const env = withGlobalNpmOnPath({ ...process.env })
const args = ['paperclipai', 'run', ...process.argv.slice(2)]
const result = spawnSync('npx', args, {
  env,
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? (result.signal ? 1 : 0))
