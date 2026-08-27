[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$urls = @(
  "https://raw.githubusercontent.com/sqzw-x/mdcx/main/mdcx/crawlers/theporndb.py",
  "https://raw.githubusercontent.com/sqzw-x/mdcx/main/mdcx/crawlers/theporndb_movies.py"
)
foreach ($u in $urls) {
  try {
    $r = Invoke-WebRequest -Uri $u -TimeoutSec 20 -UseBasicParsing
    $out = "E:\Mdcs\apps\server\scripts\_mdcx-ref-" + ($u -split "/")[-1]
    $r.Content | Out-File -FilePath $out -Encoding utf8
    Write-Host "OK $out len=$($r.Content.Length)"
  } catch {
    Write-Host "FAIL $u"
  }
}
