[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  Write-Host "`n[$Label]" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label gagal dengan exit code $LASTEXITCODE."
  }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop tidak ditemukan. Instal atau aktifkan Docker Desktop terlebih dahulu.'
}

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw 'npx tidak ditemukan. Instal Node.js terlebih dahulu.'
}

Write-Host 'Memeriksa Docker Desktop...' -ForegroundColor Cyan
& docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'Docker Desktop terpasang tetapi engine belum berjalan. Buka Docker Desktop, tunggu sampai siap, lalu ulangi skrip.'
}

$secureDatabaseUrl = Read-Host 'Paste connection string Supabase (input disembunyikan)' -AsSecureString
$databaseUrlPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureDatabaseUrl)
$databaseUrl = $null

try {
  $databaseUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($databaseUrlPointer)

  if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    throw 'Connection string kosong.'
  }

  if ($databaseUrl -match '\[YOUR-PASSWORD\]|PASTE_|YOUR-PASSWORD') {
    throw 'Connection string masih berisi placeholder password.'
  }

  $parsedUrl = $null
  if (-not [Uri]::TryCreate($databaseUrl, [UriKind]::Absolute, [ref]$parsedUrl)) {
    throw 'Format connection string tidak valid. Gunakan string postgresql:// dari menu Connect.'
  }

  if ($parsedUrl.Scheme -notin @('postgres', 'postgresql')) {
    throw 'Connection string harus menggunakan skema postgres:// atau postgresql://.'
  }

  if ($parsedUrl.Host -notlike '*.supabase.com' -and $parsedUrl.Host -notlike '*.supabase.co') {
    throw 'Host connection string tidak terlihat seperti host Supabase.'
  }

  $databaseUsername = ($parsedUrl.UserInfo -split ':', 2)[0]
  if ($parsedUrl.Host -like '*.pooler.supabase.com' -and $databaseUsername -notmatch '^postgres\.[a-z0-9]+$') {
    throw "Untuk Session pooler, username harus berbentuk postgres.PROJECT_REF, bukan '$databaseUsername'. Copy ulang string Session pooler dari menu Connect tanpa mengubah bagian username."
  }

  $repoRoot = Split-Path -Parent $PSScriptRoot
  $workspaceRoot = Split-Path -Parent $repoRoot
  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupDir = Join-Path $workspaceRoot "halo-psdm-private-backups\$timestamp"
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

  $rolesPath = Join-Path $backupDir 'roles.sql'
  $schemaPath = Join-Path $backupDir 'schema.sql'
  $dataPath = Join-Path $backupDir 'data.sql'

  Invoke-CheckedCommand -Label 'Backup roles' -Command {
    & npx --yes supabase@latest db dump --db-url $databaseUrl -f $rolesPath --role-only
  }

  Invoke-CheckedCommand -Label 'Backup schema' -Command {
    & npx --yes supabase@latest db dump --db-url $databaseUrl -f $schemaPath
  }

  Invoke-CheckedCommand -Label 'Backup data' -Command {
    & npx --yes supabase@latest db dump --db-url $databaseUrl -f $dataPath --use-copy --data-only `
      -x 'storage.buckets_vectors' `
      -x 'storage.vector_indexes'
  }

  $backupFiles = Get-ChildItem -LiteralPath $backupDir -File
  $emptyFiles = $backupFiles | Where-Object Length -le 0
  if ($emptyFiles) {
    throw "Ada file backup kosong: $($emptyFiles.Name -join ', ')."
  }

  $manifestRows = foreach ($file in $backupFiles) {
    $hash = Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256
    [PSCustomObject]@{
      Name = $file.Name
      SizeBytes = $file.Length
      ModifiedAt = $file.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss zzz')
      SHA256 = $hash.Hash
    }
  }

  $manifestPath = Join-Path $backupDir 'backup-manifest.txt'
  $manifestRows | Format-Table -AutoSize | Out-String | Set-Content -LiteralPath $manifestPath

  Write-Host "`nBACKUP BERHASIL" -ForegroundColor Green
  Write-Host "Lokasi: $backupDir" -ForegroundColor Green
  $manifestRows | Format-Table -AutoSize
  Write-Host 'Kirim hanya tabel nama/ukuran/SHA256 di atas. Jangan kirim file SQL atau connection string.' -ForegroundColor Yellow
}
finally {
  if ($databaseUrlPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($databaseUrlPointer)
  }
  $databaseUrl = $null
  $secureDatabaseUrl = $null
}
