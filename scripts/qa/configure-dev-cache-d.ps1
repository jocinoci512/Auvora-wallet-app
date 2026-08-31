# LOCAL QA — configure development caches on D: (User env, idempotent)
$ErrorActionPreference = 'Stop'
$base = 'D:\AuvoraDevCache'
$dirs = @(
  "$base\gradle",
  "$base\pub-cache",
  "$base\npm",
  "$base\pnpm\store",
  "$base\pnpm\home",
  "$base\temp"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

$map = @{
  GRADLE_USER_HOME = "$base\gradle"
  PUB_CACHE        = "$base\pub-cache"
  PNPM_HOME        = "$base\pnpm\home"
}
foreach ($kv in $map.GetEnumerator()) {
  [Environment]::SetEnvironmentVariable($kv.Key, $kv.Value, 'User')
  setx $kv.Key $kv.Value | Out-Null
}
npm config set cache "$base\npm" --location=user 2>$null
pnpm config set store-dir "$base\pnpm\store" --location user 2>$null
Write-Host "Dev caches configured under $base"
