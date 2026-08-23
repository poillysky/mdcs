[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

$conns = @()
try {
  $conns = Get-NetTCPConnection -LocalPort 9210 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
} catch {}
Write-Host ("port9210 pids: " + ($conns -join ","))
foreach ($p in $conns) {
  if ($p) {
    Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    Write-Host ("killed port pid " + $p)
  }
}

Stop-Process -Id 9096 -Force -ErrorAction SilentlyContinue

Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
  $cmd = [string]$_.CommandLine
  if ($cmd -match "mdcs|MDCS|tsx watch|vite|apps\\server|apps\\web") {
    Write-Host ("kill node " + $_.ProcessId)
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

Start-Sleep -Seconds 2
try {
  $null = Invoke-WebRequest -Uri "http://127.0.0.1:9210/health" -UseBasicParsing -TimeoutSec 2
  Write-Host "still up"
} catch {
  Write-Host "server down ok"
}
