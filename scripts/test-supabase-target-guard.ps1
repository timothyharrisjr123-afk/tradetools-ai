$ErrorActionPreference = "Stop"
$guard = Join-Path $PSScriptRoot "supabase-target-guard.ps1"
$production = "rhquhnujjnzjhweypavd"
$staging = "tjtrhdckinjtorgbkirm"
$productionPhrase = "AUTHORIZE_FIELD_DIVE_PRODUCTION_rhquhnujjnzjhweypavd"

function Assert-Guard([string]$Name, [int]$Expected, [scriptblock]$Call) {
  $global:LASTEXITCODE = 0
  $null = & $Call 2>&1
  $actual = $LASTEXITCODE
  if ($actual -ne $Expected) {
    throw "$Name expected exit $Expected but received $actual"
  }
  Write-Output "PASS $Name"
}

Assert-Guard "staging+staging" 0 { & $guard -Environment STAGING -ProjectRef $staging }
Assert-Guard "staging+production" 1 { & $guard -Environment STAGING -ProjectRef $production }
Assert-Guard "production-no-auth" 1 { & $guard -Environment PRODUCTION -ProjectRef $production }
Assert-Guard "production-controlled-auth" 0 {
  & $guard -Environment PRODUCTION -ProjectRef $production -AllowProduction `
    -ProductionAuthorization $productionPhrase
}
Assert-Guard "unknown-ref" 1 { & $guard -Environment STAGING -ProjectRef "abcdefghijklmnopqrst" }
Assert-Guard "missing-environment" 1 { & $guard -Environment "" -ProjectRef $staging }
Assert-Guard "malformed-ref" 1 { & $guard -Environment STAGING -ProjectRef "not-a-project-ref" }
Write-Output "All Supabase target guard tests passed."
