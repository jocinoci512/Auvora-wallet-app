# LOCAL QA - link Docker WSL VHDX on C: to relocated file on D: (requires Administrator, Docker stopped).
param(
  [switch]$SkipStopDocker
)

$ErrorActionPreference = 'Stop'

$link = Join-Path $env:LOCALAPPDATA 'Docker\wsl\disk\docker_data.vhdx'
$target = 'D:\DockerData\wsl\disk\docker_data.vhdx'

function Test-ReparsePoint([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $false }
  $item = Get-Item -LiteralPath $path -Force
  return ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
}

function Get-LinkTarget([string]$path) {
  try {
    $t = (Get-Item -LiteralPath $path -Force).Target
    if ($t -is [string[]]) { return $t[0] }
    return $t
  } catch {
    return $null
  }
}

function Resolve-NormalizedPath([string]$path) {
  if (-not $path) { return $null }
  try { return (Resolve-Path -LiteralPath $path -ErrorAction Stop).Path } catch { return $path }
}

function Stop-DockerDesktopProcesses {
  foreach ($name in @('Docker Desktop', 'com.docker.backend', 'com.docker.build', 'com.docker.dev-envs')) {
    Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
      Write-Host "Stopping $($_.ProcessName) (PID $($_.Id))"
      Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Seconds 8
}

if (-not $SkipStopDocker) {
  Stop-DockerDesktopProcesses
}

if (-not (Test-Path -LiteralPath $target)) {
  throw "Missing D: VHDX target (will NOT recreate): $target"
}

$targetSize = (Get-Item -LiteralPath $target).Length
Write-Host "D: VHDX present: $target ($([math]::Round($targetSize / 1GB, 2)) GB)"

if (Test-Path -LiteralPath $link) {
  if (Test-ReparsePoint $link) {
    $existing = Get-LinkTarget $link
    if ((Resolve-NormalizedPath $existing) -eq (Resolve-NormalizedPath $target)) {
      Write-Host "Docker VHDX link already correct: $link -> $target"
      [pscustomobject]@{
        LinkPath   = $link
        TargetPath = $target
        TargetSize = $targetSize
        LinkOk     = $true
        AlreadyOk  = $true
      }
      return
    }
    Write-Host "Removing broken/old link at $link"
    Remove-Item -LiteralPath $link -Force
  } else {
    $linkSize = (Get-Item -LiteralPath $link).Length
    if ($linkSize -gt 1GB) {
      throw "Unexpected real VHDX on C: at $link ($([math]::Round($linkSize / 1GB, 2)) GB). Move it to D: manually; this script will not delete it."
    }
    Remove-Item -LiteralPath $link -Force
  }
}

New-Item -ItemType Directory -Force -Path (Split-Path $link -Parent) | Out-Null
$mk = cmd.exe /c "mklink `"$link`" `"$target`""
if ($LASTEXITCODE -ne 0) { throw "mklink failed: $mk" }

if (-not (Test-Path -LiteralPath $link)) { throw "Link path missing after mklink: $link" }
$resolved = Get-LinkTarget $link
if ((Resolve-NormalizedPath $resolved) -ne (Resolve-NormalizedPath $target)) {
  throw "Link target mismatch: $resolved (expected $target)"
}

Write-Host "Docker data linked: $link -> $target"

[pscustomobject]@{
  LinkPath   = $link
  TargetPath = $target
  TargetSize = $targetSize
  LinkOk     = $true
  AlreadyOk  = $false
}
