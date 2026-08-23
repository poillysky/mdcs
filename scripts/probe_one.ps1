[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$id = $args[0]
$sec = 36
if ($args[1]) { $sec = [int]$args[1] }
if (-not $id) { Write-Host "usage: probe_one.ps1 <id> [timeoutSec]"; exit 1 }
$body = @{ id = $id; timeoutSec = $sec; clearCooldown = $true } | ConvertTo-Json -Compress
$resp = Invoke-RestMethod -Uri "http://127.0.0.1:9210/api/scrape/providers/probe" -Method POST -ContentType "application/json; charset=utf-8" -Body $body -TimeoutSec 120
$row = $resp.data.results[0]
$row | ConvertTo-Json -Depth 5
