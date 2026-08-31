# LOCAL QA - move Cursor state + sandbox cache off C: to D: (run with Cursor fully closed).
# Idempotent: verifies D: copy before removing C: source; recreates symlinks/junctions only when needed.
param(
  [switch]$SkipSandboxCache
)

$ErrorActionPreference = 'Stop'

$srcDir = Join-Path $env:APPDATA 'Cursor\User\globalStorage'
$dstDir = 'D:\AuvoraDevCache\cursor-state\live'
$sandboxSrc = Join-Path $env:TEMP 'cursor-sandbox-cache'
$sandboxDst = 'D:\AuvoraDevCache\cursor-sandbox-cache'

function Test-ReparsePoint([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $false }
  $item = Get-Item -LiteralPath $path -Force
  return ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
}

function Get-LinkTarget([string]$path) {
  try {
    $target = (Get-Item -LiteralPath $path -Force).Target
    if ($target -is [string[]]) { return $target[0] }
    return $target
  } catch {
    return $null
  }
}

function Resolve-NormalizedPath([string]$path) {
  if (-not $path) { return $null }
  try { return (Resolve-Path -LiteralPath $path -ErrorAction Stop).Path } catch { return $path }
}

function Move-FileToDWithSymlink([string]$src, [string]$destDir) {
  $name = Split-Path $src -Leaf
  $dst = Join-Path $destDir $name
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null

  if (Test-Path -LiteralPath $src) {
    if (Test-ReparsePoint $src) {
      $existing = Get-LinkTarget $src
      if ((Resolve-NormalizedPath $existing) -eq (Resolve-NormalizedPath $dst)) {
        Write-Host "Already linked: $name -> $dst"
        return $true
      }
      Remove-Item -LiteralPath $src -Force
    } else {
      if (Test-Path -LiteralPath $dst) {
        $srcSize = (Get-Item -LiteralPath $src).Length
        $dstSize = (Get-Item -LiteralPath $dst).Length
        if ($srcSize -gt $dstSize) {
          Copy-Item -LiteralPath $src -Destination $dst -Force
        }
      } else {
        Copy-Item -LiteralPath $src -Destination $dst -Force
      }
      $srcSize = (Get-Item -LiteralPath $src).Length
      $dstSize = (Get-Item -LiteralPath $dst).Length
      if ($srcSize -ne $dstSize) {
        throw "Verification failed for $name (C: $srcSize bytes, D: $dstSize bytes)."
      }
      Remove-Item -LiteralPath $src -Force
      Write-Host "Moved $name to D: ($([math]::Round($dstSize / 1GB, 2)) GB)"
    }
  } elseif (-not (Test-Path -LiteralPath $dst)) {
    Write-Host "Skip missing: $name"
    return $false
  }

  if (-not (Test-Path -LiteralPath $src)) {
    $mk = cmd.exe /c "mklink `"$src`" `"$dst`""
    if ($LASTEXITCODE -ne 0) { throw "mklink failed for ${name}: $mk" }
    Write-Host "Linked $src -> $dst"
  }

  if (-not (Test-Path -LiteralPath $dst)) { throw "Destination missing after move: $dst" }
  return $true
}

function Move-DirectoryToDWithJunction([string]$src, [string]$dst) {
  New-Item -ItemType Directory -Force -Path $dst | Out-Null

  if (Test-Path -LiteralPath $src) {
    if (Test-ReparsePoint $src) {
      $existing = Get-LinkTarget $src
      if ((Resolve-NormalizedPath $existing) -eq (Resolve-NormalizedPath $dst)) {
        Write-Host "Sandbox cache already junctioned: $src -> $dst"
        return $true
      }
      Remove-Item -LiteralPath $src -Force
    } else {
      $srcItems = @(Get-ChildItem -LiteralPath $src -Force -ErrorAction SilentlyContinue)
      if ($srcItems.Count -gt 0) {
        & robocopy $src $dst /E /MOVE /R:2 /W:2 /NFL /NDL /NJH /NJS /NC /NS | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "robocopy failed moving sandbox cache (exit $LASTEXITCODE)." }
      }
      if (Test-Path -LiteralPath $src) {
        Remove-Item -LiteralPath $src -Force -Recurse -ErrorAction SilentlyContinue
      }
      Write-Host "Moved sandbox cache to $dst"
    }
  }

  if (-not (Test-Path -LiteralPath $src)) {
    $mk = cmd.exe /c "mklink /J `"$src`" `"$dst`""
    if ($LASTEXITCODE -ne 0) { throw "mklink /J failed for sandbox cache: $mk" }
    Write-Host "Junction $src -> $dst"
  }

  return $true
}

$moved = @()
foreach ($f in @('state.vscdb', 'state.vscdb-wal', 'state.vscdb-shm')) {
  $src = Join-Path $srcDir $f
  if ((Test-Path -LiteralPath $src) -or (Test-Path (Join-Path $dstDir $f))) {
    if (Move-FileToDWithSymlink $src $dstDir) { $moved += $f }
  }
}

$sandboxMoved = $false
if (-not $SkipSandboxCache) {
  $sandboxMoved = Move-DirectoryToDWithJunction $sandboxSrc $sandboxDst
}

[pscustomobject]@{
  StateMoved       = ($moved.Count -gt 0)
  StateLocation    = $dstDir
  StateFiles       = $moved
  SandboxMoved     = $sandboxMoved
  SandboxLocation  = $sandboxDst
}
