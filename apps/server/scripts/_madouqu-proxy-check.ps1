[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$curl = "E:\Mdcs\tools\curl-impersonate\curl-impersonate.exe"
$proxy = "http://192.168.2.88:7893"
$out = Join-Path $env:TEMP "mq-proxy.html"

Write-Host "=== DNS ==="
try { Resolve-DnsName madouqu.com -ErrorAction Stop | Select-Object -First 5 | Format-Table -AutoSize } catch { Write-Host $_.Exception.Message }

Write-Host "=== direct connect 443 ==="
try {
  $tcp = New-Object System.Net.Sockets.TcpClient
  $iar = $tcp.BeginConnect("madouqu.com", 443, $null, $null)
  $ok = $iar.AsyncWaitHandle.WaitOne(8000, $false)
  if (-not $ok) { Write-Host "direct TCP timeout"; $tcp.Close() }
  else { $tcp.EndConnect($iar); Write-Host "direct TCP ok"; $tcp.Close() }
} catch { Write-Host ("direct TCP fail: " + $_.Exception.Message) }

Write-Host "=== curl via global proxy ==="
& $curl --impersonate chrome136 -x $proxy -sS -D - -o $out --max-time 30 "https://madouqu.com/?s=MDX-0006" 2>&1 | Select-Object -First 22
if (Test-Path $out) {
  $b = (Get-Item $out).Length
  Write-Host ("bytes=" + $b)
  if ($b -gt 0) {
    $h = Get-Content -Raw -Encoding UTF8 $out
    Write-Host ("challenge=" + ($h -match "Just a moment|cf-browser|challenge-platform"))
    if ($h -match "<title[^>]*>([^<]+)") { Write-Host ("title=" + $Matches[1].Trim()) }
    Write-Host ("has video/mdx=" + ($h -match "/video/mdx"))
  }
}
