[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"
$outLog = "e:\MDCS\scripts\probe_ui_order_result.txt"
"" | Set-Content -Path $outLog -Encoding UTF8

function Log([string]$msg) {
  Write-Host $msg
  Add-Content -Path $outLog -Value $msg -Encoding UTF8
}

$cfg = Invoke-RestMethod -Uri "http://127.0.0.1:9210/api/scrape/config" -TimeoutSec 15
$proxyUrl = [string]$cfg.data.config.proxyUrl
$flareUrl = [string]$cfg.data.config.flareSolverrUrl
$timeoutSec = [int]$cfg.data.config.requestTimeoutSec
if ($timeoutSec -le 0) { $timeoutSec = 30 }

Log "=== Network config ==="
Log ("proxyUrl=" + $proxyUrl)
Log ("flareSolverrUrl=" + $flareUrl)
Log ("requestTimeoutSec=" + $timeoutSec)
Log "Skip target=direct"
Log ""

if (-not $proxyUrl.Trim()) {
  Log "ERROR: proxyUrl empty. Abort."
  exit 1
}

$netApi = "http://127.0.0.1:9210/api/scrape/network/test"
foreach ($target in @("proxy", "flare")) {
  Log ("[net] testing " + $target + " ...")
  $body = @{
    target = $target
    proxyUrl = $proxyUrl
    flareSolverrUrl = $flareUrl
    timeoutSec = $timeoutSec
  } | ConvertTo-Json -Compress
  try {
    $r = Invoke-RestMethod -Uri $netApi -Method POST -ContentType "application/json; charset=utf-8" -Body $body -TimeoutSec ($timeoutSec + 60)
    $d = $r.data
    $mark = if ($d.ok) { "OK" } else { "FAIL" }
    Log ("  -> [{0}] {1} ({2}ms)" -f $mark, $d.message, $d.ms)
  } catch {
    Log ("  -> ERR " + $_.Exception.Message)
  }
}

Log ""
Log "=== Provider probe UI order (proxy -> adaptive -> flare) ==="

# Match ScrapeConfigPanel after direct merged into proxy
$ids = @(
  "dmm", "libredmm", "airav", "airav_io", "avmoo", "jav321", "avbase", "mgstage", "carib",
  "fc2", "madou", "madouqu", "freejavbt", "sevenmmtv", "iqqtv", "theporndb", "xiao_huang_shu",
  "javbus",
  "javdb", "avsox", "javlibrary", "miss_av", "fc2_hub", "fd2ppv"
)

$probeApi = "http://127.0.0.1:9210/api/scrape/providers/probe"
try {
  Invoke-RestMethod -Uri $probeApi -Method POST -ContentType "application/json" -Body '{"clearCooldown":true}' -TimeoutSec 30 | Out-Null
} catch {}

$okN = 0
$failN = 0
$i = 0
foreach ($id in $ids) {
  $i++
  Log ("[{0}/{1}] {2}" -f $i, $ids.Count, $id)
  $body = @{ id = $id; timeoutSec = [Math]::Min(25, $timeoutSec); clearCooldown = $true } | ConvertTo-Json -Compress
  try {
    $resp = Invoke-RestMethod -Uri $probeApi -Method POST -ContentType "application/json; charset=utf-8" -Body $body -TimeoutSec ($timeoutSec + 60)
    $row = $resp.data.results[0]
    $ok = [bool]$row.ok
    if ($ok) { $okN++ } else { $failN++ }
    $mark = if ($ok) { "OK" } else { "FAIL" }
    Log ("  -> [{0}] access={1} {2}ms status={3} {4}" -f $mark, $row.access, $row.ms, $row.status, $row.message)
  } catch {
    $failN++
    Log ("  -> [ERR] " + $_.Exception.Message)
  }
}

Log ""
Log ("SUMMARY OK={0} FAIL={1} TOTAL={2}" -f $okN, $failN, $ids.Count)
Log ("Log: " + $outLog)
