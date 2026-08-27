$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location (Join-Path $PSScriptRoot "..")
Write-Host "[mdcs] 安装依赖…"
npm run install:all
Write-Host "[mdcs] 启动开发服务（Web 3050 / API 9210）"
npm run dev
