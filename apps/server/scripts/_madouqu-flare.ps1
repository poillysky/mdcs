[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Read global proxy from scrape.json
$cfg = Get-Content -Raw -Encoding UTF8 "E:\Mdcs\config\scrape.json" | ConvertFrom-Json
$proxy = [string]$cfg.proxyUrl
Write-Host ("global proxy=" + $proxy)

function FlareRequest($label, $payload) {
  Write-Host ("=== flare " + $label + " ===")
  try {
    $json = $payload | ConvertTo-Json -Compress -Depth 6
    $r = Invoke-WebRequest -Uri "http://192.168.2.38:8191/v1" -Method POST -ContentType "application/json" -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) -TimeoutSec 90 -UseBasicParsing
    $c = [string]$r.Content
    Write-Host ("status=" + $r.StatusCode + " len=" + $c.Length)
    if ($c -match '"status"\s*:\s*"([^"]+)"') { Write-Host ("flare.status=" + $Matches[1]) }
    if ($c -match '"message"\s*:\s*"([^"]*)"') { Write-Host ("flare.message=" + $Matches[1]) }
    if ($c -match '"statusCode"\s*:\s*(\d+)') { Write-Host ("page.status=" + $Matches[1]) }
    if ($c -match '"url"\s*:\s*"([^"]+)"') { Write-Host ("page.url=" + $Matches[1]) }
    # rough html length
    if ($c -match '"html"\s*:\s*"') {
      $idx = $c.IndexOf('"html"')
      Write-Host ("has html near idx=" + $idx)
      Write-Host $c.Substring(0, [Math]::Min(350, $c.Length))
    } else {
      Write-Host $c.Substring(0, [Math]::Min(500, $c.Length))
    }
  } catch {
    Write-Host ("fail: " + $_.Exception.Message)
  }
}

FlareRequest "direct-no-proxy" @{
  cmd = "request.get"
  url = "https://madouqu.com/?s=MDX-0006"
  maxTimeout = 60000
}

if ($proxy) {
  FlareRequest "with-global-proxy" @{
    cmd = "request.get"
    url = "https://madouqu.com/?s=MDX-0006"
    maxTimeout = 60000
    proxy = @{ url = $proxy }
  }
}
