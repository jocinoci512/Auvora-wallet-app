# One-command Auvora Local QA lab health matrix.
# LOCAL QA ONLY.

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'local-evm-common.ps1')

function Status-Http([string]$url) {
  try {
    $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { return 'HEALTHY' }
    return "FAIL ($($r.StatusCode))"
  } catch {
    return 'FAIL'
  }
}

function Status-Docker([string]$name) {
  $line = docker ps --filter "name=$name" --format '{{.Status}}' 2>$null
  if ($line -match 'healthy') { return 'HEALTHY' }
  if ($line -match 'Up') { return 'HEALTHY' }
  return 'FAIL'
}

$postgres = Status-Docker 'auvora-postgres'
$redis = Status-Docker 'auvora-redis'
$auth = Status-Http 'http://127.0.0.1:4001/ready'
if ($auth -eq 'FAIL') { $auth = Status-Http 'http://127.0.0.1:4001/health' }
$wallet = Status-Http 'http://127.0.0.1:3002/ready'
if ($wallet -eq 'FAIL') { $wallet = Status-Http 'http://127.0.0.1:3002/health' }
$compliance = Status-Http 'http://127.0.0.1:3005/ready'
if ($compliance -eq 'FAIL') { $compliance = Status-Http 'http://127.0.0.1:3005/health' }
$notifications = Status-Http 'http://127.0.0.1:3006/health'
$connections = Status-Http 'http://127.0.0.1:3016/ready'
if ($connections -eq 'FAIL') { $connections = Status-Http 'http://127.0.0.1:3016/health' }
$gateway = Status-Http 'http://127.0.0.1:4000/ready'
if ($gateway -eq 'FAIL') { $gateway = Status-Http 'http://127.0.0.1:4000/health' }
$web = Status-Http 'http://127.0.0.1:3000/health'
if ($web -eq 'FAIL') { $web = Status-Http 'http://127.0.0.1:3000/api/health' }
if ($web -eq 'FAIL') { $web = Status-Http 'http://127.0.0.1:3000' }
$admin = Status-Http 'http://127.0.0.1:3001'
$mailpit = Status-Http 'http://127.0.0.1:8025/api/v1/info'
$bridge = Status-Http 'http://127.0.0.1:3099/health'
$localEvm = if (Test-QaEvmHealthy) { 'HEALTHY' } else { 'FAIL' }

$adb = 'D:\Android\Sdk\platform-tools\adb.exe'
$android = 'NOT CONNECTED'
$reverse = 'N/A'
$adb4000 = 'N/A'
$adb8545 = 'N/A'
if (Test-Path $adb) {
  $devs = & $adb devices 2>$null | Out-String
  if ($devs -match 'R5CW51ZMNLB\s+device') {
    $android = 'CONNECTED'
    $list = & $adb -s R5CW51ZMNLB reverse --list 2>$null | Out-String
    if (($list -match 'tcp:4000') -and ($list -match 'tcp:8545')) { $reverse = 'PASS' }
    elseif ($list -match 'tcp:4000') { $reverse = 'PARTIAL (4000 only)' }
    else { $reverse = 'FAIL' }
    $adb4000 = if ($list -match 'tcp:4000') { 'PASS' } else { 'FAIL' }
    $adb8545 = if ($list -match 'tcp:8545') { 'PASS' } else { 'FAIL' }
  }
}

Write-Host "POSTGRES       $postgres"
Write-Host "REDIS          $redis"
Write-Host "AUTH           $auth"
Write-Host "WALLET         $wallet"
Write-Host "COMPLIANCE     $compliance"
Write-Host "NOTIFICATIONS  $notifications"
Write-Host "CONNECTIONS    $connections"
Write-Host "GATEWAY        $gateway"
Write-Host "WEB            $web"
Write-Host "ADMIN          $admin"
Write-Host "LOCAL EVM      $localEvm"
Write-Host "MAILPIT        $mailpit"
Write-Host "MAIL BRIDGE    $bridge"
Write-Host "ANDROID        $android"
Write-Host "ADB REVERSE    $reverse"
if ($android -eq 'CONNECTED') {
  Write-Host "ADB 4000       $adb4000"
  Write-Host "ADB 8545       $adb8545"
}
