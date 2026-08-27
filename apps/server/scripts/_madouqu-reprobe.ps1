[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$curl = "E:\Mdcs\tools\curl-impersonate\curl-impersonate.exe"

Write-Host "=== curl home ==="
& $curl --impersonate chrome136 -sS -D - -o "$env:TEMP\madouqu-home.html" --max-time 25 "https://madouqu.com/" 2>&1 | Select-Object -First 25
Write-Host ("home bytes=" + (Get-Item "$env:TEMP\madouqu-home.html").Length)

Write-Host "=== curl search MDX-0006 ==="
& $curl --impersonate chrome136 -sS -D - -o "$env:TEMP\madouqu-search.html" --max-time 25 "https://madouqu.com/?s=MDX-0006" 2>&1 | Select-Object -First 25
Write-Host ("search bytes=" + (Get-Item "$env:TEMP\madouqu-search.html").Length)
$head = Get-Content -Encoding UTF8 "$env:TEMP\madouqu-search.html" -TotalCount 5
Write-Host ($head -join "`n")

Write-Host "=== flare sessions.list ==="
try {
  $body = '{"cmd":"sessions.list"}'
  $r = Invoke-WebRequest -Uri "http://192.168.2.38:8191/v1" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 15 -UseBasicParsing
  Write-Host ("flare status=" + $r.StatusCode)
  $c = [string]$r.Content
  Write-Host $c.Substring(0, [Math]::Min(300, $c.Length))
} catch {
  Write-Host ("flare fail: " + $_.Exception.Message)
}
