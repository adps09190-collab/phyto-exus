Get-Process -Name msiexec -ErrorAction SilentlyContinue | ForEach-Object { Write-Output "msiexec running: $($_.Id) $_.StartTime" }
try {
  $key = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer\PendingOperations' -ErrorAction Stop
  Write-Output "PendingOperations key present:"
  $key.psobject.Properties | ForEach-Object { Write-Output "$($_.Name) = $($_.Value)" }
} catch {
  Write-Output 'No PendingOperations key (or access denied)'
}
