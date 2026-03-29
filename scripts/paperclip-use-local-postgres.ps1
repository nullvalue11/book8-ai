# Run after PostgreSQL 17 is installed (default port 5432).
# If your postgres superuser has a password, set it for this session:
#   $env:PGPASSWORD = "your_postgres_password"
#   .\scripts\paperclip-use-local-postgres.ps1

param(
  [string]$DbName = "paperclip",
  [string]$AppUser = "paperclip",
  [string]$AppPassword = "paperclip_local_only"
)

$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
if (-not (Test-Path "$pgBin\psql.exe")) {
  Write-Host "PostgreSQL 17 not found at $pgBin."
  Write-Host "Install (elevated PowerShell): winget install --id PostgreSQL.PostgreSQL.17 --accept-package-agreements"
  exit 1
}

# Create DB (ignore if exists)
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "CREATE DATABASE $DbName;" 2>$null

# Create role (ignore if exists)
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "CREATE ROLE $AppUser LOGIN PASSWORD '$AppPassword';" 2>$null

& "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "ALTER USER $AppUser WITH PASSWORD '$AppPassword';"
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "ALTER DATABASE $DbName OWNER TO $AppUser;"
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d $DbName -c "GRANT ALL ON SCHEMA public TO $AppUser;"

$paperclipEnv = "$env:USERPROFILE\.paperclip\instances\default\.env"
if (-not (Test-Path (Split-Path $paperclipEnv))) {
  Write-Host "Paperclip instance missing. Run: npx paperclipai onboard --yes"
  exit 1
}

$lines = @()
if (Test-Path $paperclipEnv) { $lines = Get-Content $paperclipEnv }
$without = $lines | Where-Object { $_ -notmatch '^\s*DATABASE_URL=' }
$url = "postgresql://${AppUser}:$AppPassword@127.0.0.1:5432/$DbName"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($paperclipEnv, ($without + "DATABASE_URL=$url"), $utf8NoBom)

Write-Host "Updated $paperclipEnv with DATABASE_URL (local Postgres)."
Write-Host "Next:  npx paperclipai run"
