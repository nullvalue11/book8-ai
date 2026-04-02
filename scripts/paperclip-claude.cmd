@echo off
REM Paperclip claude_local adapter: point adapter "command" at this file (absolute path).
REM 1) Plain "claude" fails — npm shim not on Paperclip's PATH.
REM 2) Claude CLI runs child "node" — Node's folder is also usually missing from that PATH.
REM So prepend standard Node + npm locations before delegating to global claude.cmd.

if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\nodejs\node.exe" set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
if defined NVM_SYMLINK if exist "%NVM_SYMLINK%\node.exe" set "PATH=%NVM_SYMLINK%;%PATH%"
if exist "%USERPROFILE%\.volta\bin\node.exe" set "PATH=%USERPROFILE%\.volta\bin;%PATH%"
if exist "%USERPROFILE%\scoop\apps\nodejs\current\node.exe" set "PATH=%USERPROFILE%\scoop\apps\nodejs\current;%PATH%"

set "NPM_GLOBAL=%USERPROFILE%\AppData\Roaming\npm"
if exist "%NPM_GLOBAL%" set "PATH=%NPM_GLOBAL%;%PATH%"

set "CLAUDE_SHIM=%NPM_GLOBAL%\claude.cmd"
if not exist "%CLAUDE_SHIM%" (
  echo [paperclip-claude.cmd] Missing: %CLAUDE_SHIM% ^(run: npm install -g @anthropic-ai/claude-code^) 1>&2
  exit /b 1
)
call "%CLAUDE_SHIM%" %*
exit /b %ERRORLEVEL%
