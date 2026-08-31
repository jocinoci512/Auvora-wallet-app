# Replay category-A EMAIL dead letters into local Mailpit (safe, dedupe-aware).
# LOCAL QA ONLY.

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $RepoRoot
try {
  node scripts/cloud/with-env.mjs node scripts/qa/replay-dead-letter-email.mjs
} finally {
  Pop-Location
}
