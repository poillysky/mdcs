Stop-Process -Id 15388 -Force -ErrorAction SilentlyContinue
Stop-Process -Id 5452 -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
  if ($_.CommandLine -and ($_.CommandLine -match 'e2e-sone|fc2-hub|fc2_hub|_flare')) {
    Write-Host ("KILL " + $_.ProcessId)
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
Write-Host "done"
