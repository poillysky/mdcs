$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$src = "e:\mdcs\references\sehua-next-web\apps\scrape\src"
$dst = "e:\mdcs\apps\server\src\scrape\network"
Copy-Item -Force (Join-Path $src "adaptiveFlare.ts") (Join-Path $dst "adaptiveFlare.ts")
Copy-Item -Force (Join-Path $src "flaresolverr.ts") (Join-Path $dst "flaresolverr.ts")
Copy-Item -Force (Join-Path $src "download.ts") (Join-Path $dst "download.ts")
Copy-Item -Force (Join-Path $src "airavMirror.ts") (Join-Path $dst "airavMirror.ts")
Copy-Item -Force (Join-Path $src "iqqtvMirror.ts") (Join-Path $dst "iqqtvMirror.ts")
Copy-Item -Force (Join-Path $src "siteMirror.ts") (Join-Path $dst "siteMirror.ts")
Copy-Item -Force (Join-Path $src "scrapeCancel.ts") "e:\mdcs\apps\server\src\scrape\scrapeCancel.ts"
Get-ChildItem $dst | ForEach-Object { "{0}`t{1}" -f $_.Name, $_.Length }
