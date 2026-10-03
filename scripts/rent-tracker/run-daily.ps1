param(
    [string]$PythonExe = 'python',
    [string]$DataDir = (Join-Path $PSScriptRoot '../../data/rent-tracker')
)

$ErrorActionPreference = 'Stop'
$trackerPath = Join-Path $PSScriptRoot 'track.py'
$resolvedDataDir = [System.IO.Path]::GetFullPath($DataDir)

# Task Scheduler can invoke this wrapper; merely saving it does not register a task.
& $PythonExe $trackerPath collect --data-dir $resolvedDataDir --strict
$collectionExit = $LASTEXITCODE
if ($collectionExit -eq 1) { exit $collectionExit }

& $PythonExe $trackerPath export --data-dir $resolvedDataDir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
exit $collectionExit
