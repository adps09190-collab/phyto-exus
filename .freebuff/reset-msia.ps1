$ErrorActionPreference = 'SilentlyContinue'
# Try to recycle the windows installer service, which clears 1618 locks
foreach ($svc in 'msiserver', 'wuauserv', 'bits') {
    $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($s) {
        Write-Output ("Service $svc state: " + $s.Status)
        try { Restart-Service -Name $svc -Force -ErrorAction Stop; Write-Output ("Restarted $svc") } catch { Write-Output ("Could not restart $svc : " + $_.Exception.Message) }
    }
}
Start-Sleep -Seconds 3

$msi = 'C:\Users\adps0\OneDrive\Desktop\freebuff-tools\gh.msi'
$log = 'C:\Users\adps0\OneDrive\Desktop\freebuff-tools\msi.log'
$args = @('/i', $msi, '/quiet', '/norestart', 'ALLUSERS=1', 'UI=0', '/log', $log)
try {
    $proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList $args -Wait -NoNewWindow -PassThru -ErrorAction Stop
    $exit = $proc.ExitCode
} catch {
    Write-Output ("Start-Process failed: " + $_.Exception.Message)
    $exit = -1
}
Write-Output ("msiexec exit code: " + $exit)
$ghDir = 'C:\Program Files\GitHub CLI'
$found = Test-Path (Join-Path $ghDir 'gh.exe')
Write-Output ("gh.exe present in $ghDir : " + $found)
