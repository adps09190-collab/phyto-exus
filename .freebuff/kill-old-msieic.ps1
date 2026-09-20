$keep = 0
$hits = Get-Process -Name msiexec -ErrorAction SilentlyContinue
foreach ($p in $hits) {
  if ($p.Id -ne $keep) {
    Write-Output "Killing msiexec PID $($p.Id)"
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  }
}
Write-Output "done"
