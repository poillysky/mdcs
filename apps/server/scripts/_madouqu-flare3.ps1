[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
  $payload = '{"cmd":"request.get","url":"https://madouqu.com/?s=MDX-0006","maxTimeout":120000,"proxy":{"url":"http://192.168.2.88:7893"}}'
  $r = Invoke-RestMethod -Uri "http://192.168.2.38:8191/v1" -Method POST -ContentType "application/json" -Body $payload -TimeoutSec 150
  Write-Host ($r | ConvertTo-Json -Depth 4 | Out-String).Substring(0, [Math]::Min(800, (($r | ConvertTo-Json -Depth 4 | Out-String).Length)))
} catch {
  Write-Host $_.Exception.Message
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}
