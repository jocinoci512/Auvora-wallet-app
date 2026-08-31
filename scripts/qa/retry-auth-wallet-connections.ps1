$ErrorActionPreference='Continue'
$log='D:\auvora-wallet\.svc-retry.txt'
''|Set-Content $log

function Up($url){
  try{ $r=Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3; return $r.StatusCode -eq 200 } catch { return $false }
}

function StartOne($name,$port,$filter,$nodeOpts){
  if(Up "http://127.0.0.1:$port/health"){ Add-Content $log "$name already up"; return }
  $env:PORT="$port"
  $env:NODE_ENV='development'
  $env:NODE_OPTIONS=$nodeOpts
  if($name -eq 'auth'){
    $env:MAIL_DRIVER='notifications'
    $env:NOTIFICATIONS_SERVICE_URL='http://127.0.0.1:3006'
    $env:APP_PUBLIC_URL='http://localhost:3000'
  }
  Start-Process node -ArgumentList @('scripts/cloud/with-env.mjs','pnpm','--filter',$filter,'dev') -WorkingDirectory 'D:\auvora-wallet' -WindowStyle Hidden | Out-Null
  Add-Content $log "started $name"
  for($i=0;$i -lt 60;$i++){
    Start-Sleep 2
    if(Up "http://127.0.0.1:$port/health"){ Add-Content $log "$name UP after $($i*2)s"; return }
  }
  Add-Content $log "$name FAIL"
}

StartOne 'auth' 4001 '@auvora/auth-service' '--max-old-space-size=768'
StartOne 'wallet' 3002 '@auvora/wallet-service' '--max-old-space-size=768'
StartOne 'connections' 3016 '@auvora/connections-service' '--max-old-space-size=512'

foreach($u in @('http://127.0.0.1:4001/health','http://127.0.0.1:3002/health','http://127.0.0.1:3016/health','http://127.0.0.1:4000/ready','http://127.0.0.1:3000')){
  if(Up $u){ Add-Content $log "ok $u" } else {
    try{ $r=Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 3; Add-Content $log "code $u $($r.StatusCode)" }
    catch{ $c=$null; try{$c=[int]$_.Exception.Response.StatusCode}catch{}; if($c){Add-Content $log "code $u $c"} else {Add-Content $log "down $u"} }
  }
}
