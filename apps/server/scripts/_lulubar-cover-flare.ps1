[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$img = "https://image.lulubar.co/films/2023/12/10/1968049/SONE-001-2.jpg"
$fs = "http://192.168.2.38:8191/v1"
$proxy = "http://192.168.2.88:7893"
$cf = (Get-Content "E:\Mdcs\data\meta\cf-clearance.json" -Raw | ConvertFrom-Json).hosts."lulubar.co".cookieHeader
$body = @{
  cmd = "request.get"
  url = $img
  maxTimeout = 60000
  proxy = @{ url = $proxy }
  cookies = @(@{ name = "cf_clearance"; value = ($cf -replace '^.*cf_clearance=([^;]+).*$','$1') })
} | ConvertTo-Json -Depth 5
Write-Host "FS probe image CDN..."
$r = Invoke-RestMethod -Uri $fs -Method Post -Body $body -ContentType "application/json" -TimeoutSec 90
Write-Host "status=$($r.status) solution.status=$($r.solution.status) len=$($r.solution.response.Length)"
if ($r.solution.response.Length -gt 0) {
  $bytes = [System.Text.Encoding]::Latin1.GetBytes($r.solution.response.Substring(0, [Math]::Min(4, $r.solution.response.Length)))
  Write-Host "head bytes: $($bytes -join ',')"
}
