# Shared helpers for Auvora automated storage recovery (LOCAL QA only).

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-DriveFreeGB([string]$letter) {
  $drive = Get-PSDrive -Name $letter -ErrorAction SilentlyContinue
  if (-not $drive) { return 0 }
  return [math]::Round($drive.Free / 1GB, 2)
}

function Get-CursorProcesses {
  Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $n = $_.ProcessName
    $n -eq 'Cursor' -or $n -eq 'cursor' -or $n -like 'Cursor*' -or $n -eq 'cursor-tunnel'
  }
}

function Wait-CursorProcessesExit {
  param(
    [int]$TimeoutSec = 600,
    [scriptblock]$Log = { param($m) Write-Host $m }
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $procs = @(Get-CursorProcesses)
    if ($procs.Count -eq 0) { return $true }
    & $Log "Waiting for Cursor to exit ($($procs.Count) process(es)) ..."
    Start-Sleep -Seconds 3
  }
  return $false
}

function Resolve-CursorExe {
  @(
    (Join-Path $env:LOCALAPPDATA 'Programs\cursor\Cursor.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Cursor\Cursor.exe'),
    "${env:ProgramFiles}\Cursor\Cursor.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Resolve-DockerDesktopExe {
  @(
    "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Invoke-GracefulCursorShutdown {
  param([int]$GraceSec = 20)
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class AuvoraWinClose {
  [DllImport("user32.dll")]
  public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
}
"@ -ErrorAction SilentlyContinue

  foreach ($proc in @(Get-CursorProcesses)) {
    try {
      if ($proc.MainWindowHandle -ne [IntPtr]::Zero) {
        [void][AuvoraWinClose]::PostMessage($proc.MainWindowHandle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
      }
    } catch {}
  }

  $deadline = (Get-Date).AddSeconds($GraceSec)
  while ((Get-Date) -lt $deadline) {
    if (@(Get-CursorProcesses).Count -eq 0) { return $true }
    Start-Sleep -Seconds 2
  }

  foreach ($proc in @(Get-CursorProcesses)) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction Stop } catch {}
  }
  Start-Sleep -Seconds 2
  return (@(Get-CursorProcesses).Count -eq 0)
}

function Get-StorageCandidatesReport {
  $lines = New-Object System.Collections.Generic.List[string]
  $checks = @(
    @{ Path = Join-Path $env:TEMP 'cursor-sandbox-cache'; Label = 'TEMP cursor-sandbox-cache' },
    @{ Path = Join-Path $env:APPDATA 'Cursor\snapshots'; Label = 'Cursor snapshots (if not junctioned)' },
    @{ Path = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\OptGuideOnDeviceModel'; Label = 'Chrome on-device ML models (regenerable)' },
    @{ Path = Join-Path $env:USERPROFILE '.gradle'; Label = 'Gradle cache (if not on D:)' }
  )
  foreach ($c in $checks) {
    if (Test-Path -LiteralPath $c.Path) {
      try {
        $sizeGb = [math]::Round((Get-ChildItem -LiteralPath $c.Path -Recurse -Force -ErrorAction SilentlyContinue |
          Measure-Object Length -Sum).Sum / 1GB, 2)
        if ($sizeGb -ge 0.5) { $lines.Add("$($c.Label): ~${sizeGb} GB at $($c.Path)") }
      } catch {}
    }
  }
  if ($lines.Count -eq 0) { return 'No additional large safe candidates auto-detected.' }
  return ($lines -join '; ')
}
