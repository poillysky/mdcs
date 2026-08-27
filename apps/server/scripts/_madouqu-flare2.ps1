[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"
$curl = "E:\Mdcs\tools\curl-impersonate\curl-impersonate.exe"
$proxy = "http://192.168.2.88:7893"

Write-Host "=== curl via global proxy home ==="
& $curl --impersonate chrome136 -x $proxy -sS -D - -o "$env:TEMP\madouqu-proxy.html" --max-time 30 "https://madouqu.com/" 2>&1 | Select-Object -First 20
if (Test-Path "$env:TEMP\madouqu-proxy.html") {
  Write-Host ("bytes=" + (Get-Item "$env:TEMP\madouqu-proxy.html").Length)
}

Write-Host "=== flare 500 body (no proxy) ==="
try {
  $payload = '{"cmd":"request.get","url":"https://madouqu.com/","maxTimeout":45000}'
  Invoke-RestMethod -Uri "http://192.168.2.38:8191/v1" -Method POST -ContentType "application/json" -Body $payload -TimeoutSec 60
} catch {
  Write-Host $_.Exception.Message
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
  if ($_.Exception.Response) {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host $reader.ReadToEnd()
  }
}

Write-Host "=== flare 500 body (with proxy) ==="
try {
  $payload2 = '{"cmd":"request.get","url":"https://madouqu.com/","maxTimeout":45000,"proxy":{"url":"http://192.168.2.88:7893"}}'
  Invoke-RestMethod -Uri "http://192.168.2.38:8191/v1" -Method POST -ContentType "application/json" -Body $payload2 -TimeoutSec 90
} catch {
  Write-Host $_.Exception.Message
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
  if ($_.Exception.Response) {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host $reader.ReadToEnd()
  }
}
