$ghDir = 'C:\Program Files\GitHub CLI'
$env:Path = [Environment]::GetEnvironmentVariable('Path','User') + ';' + [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + $ghDir
if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh --version
} else {
    Write-Output 'gh still not found after User-Path add (dir check):'
    Test-Path (Join-Path $ghDir 'gh.exe')  | Out-Null
    if (Test-Path (Join-Path $ghDir 'gh.exe')) { Write-Output 'gh.exe IS present in ' $ghDir }
    else { Write-Output 'gh.exe NOT present in ' $ghDir }
}
