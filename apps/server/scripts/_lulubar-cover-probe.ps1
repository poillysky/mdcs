[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$curl = "E:\Mdcs\tools\curl-impersonate\curl-impersonate.exe"
$proxy = "http://192.168.2.88:7893"
$cf = (Get-Content "E:\Mdcs\data\meta\cf-clearance.json" -Raw | ConvertFrom-Json).hosts."lulubar.co".cookieHeader
$ref = "https://lulubar.co/video/detail?id=364579"
$urls = @(
  "https://image.lulubar.co/films/2023/12/10/1968049/SONE-001-2.jpg",
  "https://lulubar.co/films/2023/12/10/1968048/SONE-001-1.jpg",
  "https://lulubar.co/films/2023/12/10/1968049/SONE-001-2.jpg",
  "https://image.lulubar.co/films/2023/12/10/1968048/SONE-001-1.jpg"
)
foreach ($u in $urls) {
  Write-Host "=== $u"
  & $curl --impersonate chrome136 -sS --max-time 12 -o NUL -w "proxy+cookie: %{http_code} size=%{size_download}`n" -x $proxy -e $ref -H "Cookie: $cf" $u
}
