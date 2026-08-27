#Requires -Version 5.1
<#
.SYNOPSIS
  安装 lexiforest/curl-impersonate（Windows x64）供 MDCS 带 cf_clearance 取页。
.NOTES
  飞牛 NAS 走 Docker 镜像内置，不必在 NAS 主机装本脚本。
#>
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $Root "apps\server"))) {
  $Root = "E:\Mdcs"
}
$Dest = Join-Path $Root "tools\curl-impersonate"
$Ver = "v2.1.1"
$Url = "https://github.com/lexiforest/curl-impersonate/releases/download/$Ver/curl-impersonate-$Ver.x86_64-win32.tar.gz"
$TmpGz = Join-Path $env:TEMP "curl-impersonate-$Ver-win64.tar.gz"
$TmpTar = Join-Path $env:TEMP "curl-impersonate-$Ver-win64.tar"

Write-Host "MDCS root: $Root"
Write-Host "Install to: $Dest"
Write-Host "Download: $Url"

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Write-Host "Downloading..."
curl.exe -fsSL -o $TmpGz $Url
if (-not (Test-Path $TmpGz) -or (Get-Item $TmpGz).Length -lt 100000) {
  throw "Download failed or file too small: $TmpGz"
}

# Windows tar 可解 .tar.gz
Write-Host "Extracting..."
if (Test-Path $TmpTar) { Remove-Item $TmpTar -Force }
# 先解压到临时目录再拷贝，避免脏文件
$Stage = Join-Path $env:TEMP "curl-impersonate-stage-$Ver"
if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null
tar.exe -xzf $TmpGz -C $Stage

# 找 curl_chrome* / curl-impersonate*
$Bins = Get-ChildItem -Path $Stage -Recurse -File | Where-Object {
  $_.Name -match '^(curl_chrome|curl-impersonate|curl_edge|curl_ff)'
}
if (-not $Bins) {
  Write-Host "Staged tree:"
  Get-ChildItem $Stage -Recurse | Select-Object -First 40 FullName
  throw "No curl_chrome* binaries found in archive"
}

Get-ChildItem $Dest -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
foreach ($f in $Bins) {
  Copy-Item $f.FullName (Join-Path $Dest $f.Name) -Force
}
# 同目录可能还有 dll
Get-ChildItem -Path $Stage -Recurse -Include *.dll,*.so* -File -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $Dest $_.Name) -Force
}

$Exe = Join-Path $Dest "curl-impersonate.exe"
if (-not (Test-Path $Exe)) { throw "curl-impersonate.exe missing after extract" }
$Target = "chrome136"

Write-Host ""
Write-Host "Installed binaries:"
Get-ChildItem $Dest | Select-Object Name, Length | Format-Table -AutoSize
Write-Host "Preferred: $Exe --impersonate $Target"
& $Exe --impersonate $Target --version 2>&1 | Select-Object -First 3

# Node 不能 spawn .bat；指向 exe，指纹由 --impersonate 注入
[Environment]::SetEnvironmentVariable("SCRAPE_CURL_BIN", $Exe, "User")
[Environment]::SetEnvironmentVariable("SCRAPE_CURL_IMPERSONATE", $Target, "User")
$env:SCRAPE_CURL_BIN = $Exe
$env:SCRAPE_CURL_IMPERSONATE = $Target
Write-Host ""
Write-Host "Set User env SCRAPE_CURL_BIN=$Exe"
Write-Host "Set User env SCRAPE_CURL_IMPERSONATE=$Target"
Write-Host "Restart Cursor / 终端后生效。飞牛 NAS 用镜像内置，不必跑本脚本。"
Write-Host "Done."
