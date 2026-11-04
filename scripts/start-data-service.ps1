$ErrorActionPreference = 'Stop'
$temoAppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$temoPython = Join-Path $temoAppRoot '.venv-data\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $temoPython)) {
    throw 'Create .venv-data and install data_pipeline/requirements.txt first.'
}
Set-Location -LiteralPath $temoAppRoot
& $temoPython -u -m data_pipeline.service
exit $LASTEXITCODE
