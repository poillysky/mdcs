[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$curl = "E:\Mdcs\tools\curl-impersonate\curl-impersonate.exe"
$out = Join-Path $env:TEMP "mq-v4.html"

Write-Host "=== TCP IPv4 202.160.130.52:443 ==="
try {
  $tcp = New-Object System.Net.Sockets.TcpClient
  $iar = $tcp.BeginConnect("202.160.130.52", 443, $null, $null)
  $ok = $iar.AsyncWaitHandle.WaitOne(8000, $false)
  if (-not $ok) { Write-Host "IPv4 TCP timeout"; $tcp.Close() }
  else { $tcp.EndConnect($iar); Write-Host "IPv4 TCP ok"; $tcp.Close() }
} catch { Write-Host ("IPv4 TCP fail: " + $_.Exception.Message) }

Write-Host "=== curl -4 direct ==="
& $curl --impersonate chrome136 -4 -sS -D - -o $out --max-time 25 "https://madouqu.com/?s=MDX-0006" 2>&1 | Select-Object -First 20
if (Test-Path $out) {
  Write-Host ("bytes=" + (Get-Item $out).Length)
  $h = Get-Content -Raw -Encoding UTF8 $out -ErrorAction SilentlyContinue
  if ($h) {
    Write-Host ("challenge=" + ($h -match "Just a moment|cf-browser|challenge-platform"))
    if ($h -match "<title[^>]*>([^<]+)") { Write-Host ("title=" + $Matches[1].Trim()) }
  }
}

Write-Host "=== curl -4 resolve force ==="
& $curl --impersonate chrome136 --resolve "madouqu.com:443:202.160.130.52" -sS -D - -o $out --max-time 25 "https://madouqu.com/?s=MDX-0006" 2>&1 | Select-Object -First 20
