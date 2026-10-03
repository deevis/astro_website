param(
    [string]$PythonExe = 'python',
    [string]$DataDir = (Join-Path $PSScriptRoot '../../data/grid-tracker'),
    [int]$Days = 45
)

$ErrorActionPreference = 'Stop'
$trackerPath = Join-Path $PSScriptRoot 'track.py'
$resolvedDataDir = [System.IO.Path]::GetFullPath($DataDir)
# Configure a scheduler to disallow overlapping runs. This file does not install a task.
& $PythonExe $trackerPath collect --data-dir $resolvedDataDir --days $Days
$collectionExit = $LASTEXITCODE
if ($collectionExit -eq 1) { exit $collectionExit }
& $PythonExe $trackerPath export --data-dir $resolvedDataDir --days $Days
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $PythonExe $trackerPath report --data-dir $resolvedDataDir --days $Days
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
exit $collectionExit
