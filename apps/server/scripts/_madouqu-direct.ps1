[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$curl = "E:\Mdcs\tools\curl-impersonate\curl-impersonate.exe"
$homeOut = Join-Path $env:TEMP "mq-home.html"
$searchOut = Join-Path $env:TEMP "mq-search.html"

Write-Host "=== config madouqu ==="
Select-String -Path "E:\Mdcs\config\scrape.json" -Pattern "madouqu" -Context 0,10 |
  ForEach-Object { $_.Line; $_.Context.PostContext }

Write-Host "=== direct curl home (no -x) ==="
& $curl --impersonate chrome136 -sS -D - -o $homeOut --max-time 25 "https://madouqu.com/" 2>&1 | Select-Object -First 18
if (Test-Path $homeOut) {
  $hb = (Get-Item $homeOut).Length
  $h = Get-Content -Raw -Encoding UTF8 $homeOut
  Write-Host ("home bytes=" + $hb)
  Write-Host ("challenge=" + ($h -match "Just a moment|cf-browser|challenge-platform|cf-mitigated"))
  if ($h -match "<title[^>]*>([^<]+)") { Write-Host ("title=" + $Matches[1].Trim()) }
}

Write-Host "=== direct curl search MDX-0006 ==="
& $curl --impersonate chrome136 -sS -D - -o $searchOut --max-time 25 "https://madouqu.com/?s=MDX-0006" 2>&1 | Select-Object -First 18
if (Test-Path $searchOut) {
  Write-Host ("search bytes=" + (Get-Item $searchOut).Length)
}
