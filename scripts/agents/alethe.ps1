param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$AletheArgs
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$skillRoot = Join-Path $env:USERPROFILE '.codex/plugins/cache/alethe/alethe-orchestrate'
$version = Get-ChildItem -LiteralPath $skillRoot -Directory |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1
if (-not $version) { throw 'Skill Alethe não encontrada.' }

$runner = Join-Path $version.FullName 'skills/alethe/scripts/orchestrate.py'
$runtimePath = Join-Path $projectRoot 'server/tmp/alethe'
$null = New-Item -ItemType Directory -Path $runtimePath -Force
$previousPlaybooks = $env:ALETHE_ORCHESTRATE_PLAYBOOKS
$previousPolicy = $env:ALETHE_ORCHESTRATE_POLICY
$resultCode = 1
Push-Location -LiteralPath $projectRoot
try {
    $env:ALETHE_ORCHESTRATE_PLAYBOOKS = Join-Path $PSScriptRoot 'alethe-playbooks.yaml'
    $env:ALETHE_ORCHESTRATE_POLICY = Join-Path $runtimePath 'policy.json'
    & python $runner @AletheArgs
    $resultCode = $LASTEXITCODE
} finally {
    $env:ALETHE_ORCHESTRATE_PLAYBOOKS = $previousPlaybooks
    $env:ALETHE_ORCHESTRATE_POLICY = $previousPolicy
    Pop-Location
}
exit $resultCode
