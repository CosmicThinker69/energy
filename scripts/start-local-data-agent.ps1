$ErrorActionPreference = 'Stop'
$temoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $temoRoot
$temoNode = (Get-Command node.exe).Source
$temoAgent = Start-Process -FilePath $temoNode -ArgumentList @('--conditions=react-server','--import','tsx','scripts/local-data-agent.ts') -WorkingDirectory $temoRoot -WindowStyle Hidden -RedirectStandardOutput '.data/local-data-agent.stdout.log' -RedirectStandardError '.data/local-data-agent.stderr.log' -Wait -PassThru
exit $temoAgent.ExitCode
