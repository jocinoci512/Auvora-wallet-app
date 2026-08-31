# LOCAL QA ONLY — compares registered public addresses for physical QA user (safe output).
$ErrorActionPreference = 'Stop'
$userId = 'df1db712-5e50-42c1-92fc-2c7236244cf8'

function Mask([string]$addr) {
  if ($addr.Length -le 12) { return $addr }
  return ($addr.Substring(0, 6) + '…' + $addr.Substring($addr.Length - 4))
}

Write-Host "=== USER ==="
docker exec auvora-postgres psql -U auvora -d auvora_wallet -c "
SELECT id, email, username, first_name, last_name FROM users WHERE id = '$userId';
"

Write-Host "`n=== WATCH ADDRESSES ==="
docker exec auvora-postgres psql -U auvora -d auvora_wallet -c "
SELECT network, address, link_mode FROM watch_addresses WHERE user_id = '$userId' ORDER BY network;
"

Write-Host "`n=== CHAIN ADDRESSES ==="
docker exec auvora-postgres psql -U auvora -d auvora_wallet -c "
SELECT chain, address, status FROM chain_addresses WHERE owner_user_id = '$userId' ORDER BY chain;
"

Write-Host "`n=== WALLET METADATA (public address in chainSync) ==="
docker exec auvora-postgres psql -U auvora -d auvora_wallet -c "
SELECT a.code AS asset, w.alias, w.metadata->'chainSync'->>'address' AS address
FROM wallets w
JOIN assets a ON a.id = w.asset_id
WHERE w.owner_user_id = '$userId'
ORDER BY a.code;
"

Write-Host "`n=== VAULT BLOB (count only) ==="
docker exec auvora-postgres psql -U auvora -d auvora_wallet -tAc "
SELECT COUNT(*) FROM encrypted_vault_blobs WHERE owner_user_id = '$userId';
"
