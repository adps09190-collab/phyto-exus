$found = $false
$paths = @('C:\Program Files\GitHub CLI\gh.exe', "$env:APPDATA\GitHub CLI\gh.exe", "$env:LOCALAPPDATA\GitHub CLI\gh.exe")
foreach ($p in $paths) {
    if (Test-Path $p) {
        Write-Output "FOUND: $p"
        $found = $true
    }
}
if (-not $found) {
    Write-Output 'gh.exe not found in the usual locations'
    # broad search under program files just in case
    $hits = Get-ChildItem -Path 'C:\Program Files' -Filter 'gh.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 5 -ExpandProperty FullName
    if ($hits) { $hits | ForEach-Object { Write-Output "FOUND(via recuse): $_" } }
    else { Write-Output 'No gh.exe anywhere under C:\Program Files' }
}
