$ErrorActionPreference = 'Stop'
$temoAppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$temoLauncher = Join-Path $PSScriptRoot 'start-data-service.ps1'
$temoIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$temoAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $temoLauncher + '"') -WorkingDirectory $temoAppRoot
$temoTrigger = New-ScheduledTaskTrigger -AtLogOn -User $temoIdentity
$temoSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$temoPrincipal = New-ScheduledTaskPrincipal -UserId $temoIdentity -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'TEMO Energy Data Collector' -Action $temoAction -Trigger $temoTrigger -Settings $temoSettings -Principal $temoPrincipal -Description 'Resumable TEMO energy backfill and hourly provider updates.' -Force | Out-Null
Start-ScheduledTask -TaskName 'TEMO Energy Data Collector'
Write-Output 'TEMO data collector task installed and started for the current Windows account.'
