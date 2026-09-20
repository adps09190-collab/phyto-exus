$ErrorActionPreference = 'Stop'
$msi = 'https://github.com/cli/cli/releases/download/v2.101.0/gh_2.101.0_windows_amd64.msi'
$outDir = 'C:\Users\adps0\OneDrive\Desktop\freebuff-tools'
$out = Join-Path $outDir 'gh.msi'

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
(New-Object Net.WebClient).DownloadFile($msi, $out)
$out
