# LOCAL QA - safety snapshot of working tree before storage recovery (no git push/reset/clean).
param(
  [string]$RepoRoot = 'D:\auvora-wallet',
  [string]$BackupRoot = 'D:\AuvoraArchive\safety\pre-storage-recovery'
)

$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dest = Join-Path $BackupRoot $stamp
$filesDir = Join-Path $dest 'files'
New-Item -ItemType Directory -Force -Path $filesDir | Out-Null

function Write-TextFile([string]$path, [string]$content) {
  $content | Set-Content -Path $path -Encoding UTF8
}

function Should-BackupUntracked([string]$rel) {
  $prefixes = @('apps\', 'services\', 'packages\', 'database\', 'scripts\qa\', 'scripts\cloud\')
  foreach ($p in $prefixes) {
    if ($rel.StartsWith($p, [StringComparison]::OrdinalIgnoreCase)) { return $true }
  }
  return $false
}

Set-Location $RepoRoot
$pathExcludes = @(':(exclude).gradle-user-home', ':(exclude)artifacts', ':(exclude)node_modules')
$head = (git rev-parse HEAD).Trim()
$branch = (git branch --show-current).Trim()
$status = git status --porcelain -- . @pathExcludes
$diffStat = git diff --stat -- . @pathExcludes
$diff = git diff -- . @pathExcludes
$diffCached = git diff --cached -- . @pathExcludes
$untracked = git ls-files --others --exclude-standard -- . @pathExcludes
$modifiedNames = @((git diff --name-only -- . @pathExcludes) + (git diff --cached --name-only -- . @pathExcludes) | Sort-Object -Unique)

Write-TextFile (Join-Path $dest 'git-head.txt') $head
Write-TextFile (Join-Path $dest 'git-branch.txt') $branch
Write-TextFile (Join-Path $dest 'git-status-porcelain.txt') ($status -join "`n")
Write-TextFile (Join-Path $dest 'git-diff-stat.txt') $diffStat
Write-TextFile (Join-Path $dest 'git-diff.patch') $diff
Write-TextFile (Join-Path $dest 'git-diff-cached.patch') $diffCached
Write-TextFile (Join-Path $dest 'untracked-files.txt') ($untracked -join "`n")

$copied = 0
$copyErrors = 0
foreach ($rel in $modifiedNames) {
  if (-not $rel) { continue }
  $src = Join-Path $RepoRoot $rel
  if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { continue }
  $target = Join-Path $filesDir $rel
  try {
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Copy-Item -LiteralPath $src -Destination $target -Force
    $copied++
  } catch { $copyErrors++ }
}

foreach ($rel in $untracked) {
  if (-not $rel) { continue }
  if (-not (Should-BackupUntracked $rel)) { continue }
  $src = Join-Path $RepoRoot $rel
  if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { continue }
  $target = Join-Path $filesDir $rel
  try {
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Copy-Item -LiteralPath $src -Destination $target -Force
    $copied++
  } catch { $copyErrors++ }
}

Write-TextFile (Join-Path $dest 'backup-meta.txt') @"
timestamp=$stamp
repo=$RepoRoot
head=$head
branch=$branch
status_lines=$($status.Count)
modified_tracked=$($modifiedNames.Count)
untracked_listed=$($untracked.Count)
files_copied=$copied
copy_errors=$copyErrors
"@

Write-Output $dest
