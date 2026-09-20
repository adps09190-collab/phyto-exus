$ErrorActionPreference = 'Stop'

$msi = 'C:\Users\adps0\OneDrive\Desktop\freebuff-tools\gh.msi'
$log = 'C:\Users\adps0\OneDrive\Desktop\freebuff-tools\msi.log'

# Prefer per-machine UI=0 install so it does not require the Admin prompt path.
$args = @('/i', $msi, '/quiet', '/norestart', 'ALLUSERS=1', 'UI=0', '/log', $log)
try {
    $proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList $args -Wait -NoNewWindow -PassThru -ErrorAction Stop
    $exit = $proc.ExitCode
} catch {
    Write-Output "Start-Process failed: $_"
    $exit = -1
}

Write-Output ("msiexec exit code: " + $exit)
$ghDir = 'C:\Program Files\GitHub CLI'
$found = Test-Path (Join-Path $ghDir 'gh.exe')
Write-Output ("gh.exe present in $ghDir : " + $found)
