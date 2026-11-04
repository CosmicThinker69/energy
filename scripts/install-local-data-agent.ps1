$ErrorActionPreference = 'Stop'
$temoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$temoLauncher = Join-Path $PSScriptRoot 'start-local-data-agent.ps1'
$temoIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$temoAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $temoLauncher + '"') -WorkingDirectory $temoRoot
$temoTrigger = New-ScheduledTaskTrigger -AtLogOn -User $temoIdentity
$temoSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$temoPrincipal = New-ScheduledTaskPrincipal -UserId $temoIdentity -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'TEMO Local Data Agent' -Action $temoAction -Trigger $temoTrigger -Settings $temoSettings -Principal $temoPrincipal -Description 'Authenticated outbound bridge from local TEMO market data to the Railway portal.' -Force | Out-Null
Start-ScheduledTask -TaskName 'TEMO Local Data Agent'
Write-Output 'TEMO local data agent installed and started.'
