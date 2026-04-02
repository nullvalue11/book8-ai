/**
 * Launches `npx paperclipai run` with PATH augmented so `claude` resolves.
 *
 * Fixes: Command not found in PATH: "claude" when Paperclip inherits a minimal
 * PATH (GUI launchers, services, daemons) that omits npm global bin and native
 * Claude Code install dirs.
 *
 * Usage: node scripts/run-paperclip.mjs
 *        npm run paperclip
 *
 * Windows + Paperclip still says "claude" not found? Run once (Paperclip DB up):
 *   npm run paperclip:patch-claude
 * That stores scripts/paperclip-claude.cmd in each claude_local agent's adapter_config.command.
 * Or set command manually to the path from: npm run paperclip:claude-proxy-path
 *
 * If runs still fail with EPERM on symlinks under .claude/skills, enable Windows
 * Developer Mode: Settings → Privacy & Security → For developers → Developer Mode.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { existsSync } from 'node:fs'

/** Windows: claude.exe (native), claude.cmd (npm shim). Unix: claude */
function dirContainsClaudeBinary(dir) {
  if (!dir || !existsSync(dir)) return false
  if (os.platform() === 'win32') {
    for (const name of ['claude.exe', 'claude.cmd', 'claude.bat']) {
      if (existsSync(path.join(dir, name))) return true
    }
    return false
  }
  return existsSync(path.join(dir, 'claude'))
}

/** If the current environment already finds `claude`, use that directory first. */
function claudeDirFromSystemResolver(env) {
  try {
    if (os.platform() === 'win32') {
      const r = spawnSync('where.exe', ['claude'], {
        encoding: 'utf8',
        env: { ...env },
        shell: false
      })
      if (r.status === 0 && r.stdout) {
        const line = r.stdout.trim().split(/\r?\n/)[0]?.trim()
        if (line && existsSync(line)) return path.dirname(line)
      }
    } else {
      const r = spawnSync('which', ['claude'], {
        encoding: 'utf8',
        env: { ...env },
        shell: false
      })
      if (r.status === 0 && r.stdout) {
        const line = r.stdout.trim().split('\n')[0]?.trim()
        if (line && existsSync(line)) return path.dirname(line)
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function claudeCandidateDirs() {
  const home = os.homedir()
  const localApp = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')

  if (os.platform() === 'win32') {
    return [
      path.join(home, 'AppData', 'Roaming', 'npm'),
      path.join(localApp, 'Programs', 'claude-code'),
      path.join(localApp, 'Programs', 'Claude'),
      path.join(localApp, 'Programs', 'Claude Code'),
      path.join(localApp, 'Microsoft', 'WinGet', 'Links'),
      path.join(localApp, 'AnthropicClaude'),
      path.join(home, 'scoop', 'shims'),
      path.join(home, '.bun', 'bin'),
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Claude') : '',
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Claude Code') : '',
      process.env['ProgramFiles(x86)']
        ? path.join(process.env['ProgramFiles(x86)'], 'Claude')
        : ''
    ].filter(Boolean)
  }

  return [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(home, '.local', 'bin'),
    path.join(home, '.bun', 'bin'),
    '/usr/bin'
  ]
}

/**
 * Build ordered, unique dirs to prepend so `claude` is on PATH for child processes
 * (including the Paperclip server and its agent adapter).
 */
function claudePathPrefixes(baseEnv) {
  const ordered = []
  const seen = new Set()

  const push = (d) => {
    if (!d) return
    const norm = path.normalize(d)
    if (seen.has(norm)) return
    seen.add(norm)
    ordered.push(norm)
  }

  const resolved = claudeDirFromSystemResolver(baseEnv)
  if (resolved) push(resolved)

  for (const d of claudeCandidateDirs()) {
    if (dirContainsClaudeBinary(d)) push(d)
  }

  // npm global: include when folder exists (may hold shim even if not pre-checked)
  if (os.platform() === 'win32') {
    const npmGlobal = path.join(os.homedir(), 'AppData', 'Roaming', 'npm')
    if (existsSync(npmGlobal)) push(npmGlobal)
  } else {
    for (const d of ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local', 'bin')]) {
      if (existsSync(d)) push(d)
    }
  }

  return ordered
}

function withClaudeOnPath(baseEnv) {
  const cur = baseEnv.Path || baseEnv.PATH || ''
  const prefixes = claudePathPrefixes(baseEnv)
  if (prefixes.length === 0) return baseEnv
  const prefix = prefixes.join(path.delimiter)
  const next = `${prefix}${path.delimiter}${cur}`
  return { ...baseEnv, Path: next, PATH: next }
}

const env = withClaudeOnPath({ ...process.env })

if (process.env.PAPERCLIP_DEBUG_PATH === '1') {
  const sample = spawnSync(
    os.platform() === 'win32' ? 'where.exe' : 'which',
    ['claude'],
    { encoding: 'utf8', env, shell: false }
  )
  console.error('[run-paperclip] claude resolve:', sample.status === 0 ? sample.stdout.trim() : sample.stderr || 'not found')
}

const args = ['paperclipai', 'run', ...process.argv.slice(2)]
const result = spawnSync('npx', args, {
  env,
  stdio: 'inherit',
  shell: true
})
process.exit(result.status ?? (result.signal ? 1 : 0))
