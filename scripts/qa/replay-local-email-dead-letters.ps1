# LOCAL QA ONLY — replay EMAIL dead letters via internal API + local DB (no Admin JWT).
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$env:AUVORA_QA_ALLOW_EMAIL_REPLAY = 'true'
Push-Location $RepoRoot
try {
  node scripts/cloud/with-env.mjs node scripts/qa/replay-local-email-dead-letters.mjs @args
} finally {
  Pop-Location
}
