[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [AllowEmptyString()] [string]$Environment,
  [Parameter(Mandatory = $true)] [string]$ProjectRef,
  [switch]$AllowProduction,
  [string]$ProductionAuthorization = ""
)

$ErrorActionPreference = "Stop"
$registryPath = Join-Path $PSScriptRoot "..\supabase\environments.json"
$productionPhrase = "AUTHORIZE_FIELD_DIVE_PRODUCTION_rhquhnujjnzjhweypavd"

function Deny([string]$Reason) {
  [Console]::Error.WriteLine("SUPABASE TARGET DENIED: $Reason")
  exit 1
}

if (-not (Test-Path -LiteralPath $registryPath -PathType Leaf)) {
  Deny "environment registry is missing"
}
try {
  $registry = Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json
} catch {
  Deny "environment registry is invalid JSON"
}

$resolvedEnvironment = $Environment.Trim().ToLowerInvariant()
$resolvedRef = $ProjectRef.Trim()
if ($resolvedEnvironment -notin @("staging", "production")) {
  Deny "environment must be exactly STAGING or PRODUCTION"
}
if ($resolvedRef -notmatch '^[a-z]{20}$') {
  Deny "project ref is missing or malformed"
}

$production = $registry.environments.production
$staging = $registry.environments.staging
if (-not $production -or -not $staging) {
  Deny "registry must define production and staging"
}
if ($resolvedRef -notin @($production.project_ref, $staging.project_ref)) {
  Deny "unknown project ref"
}

$expected = $registry.environments.$resolvedEnvironment
if (-not $expected -or $resolvedRef -ne $expected.project_ref) {
  Deny "environment and project ref do not agree"
}
if ($resolvedEnvironment -eq "production") {
  if (-not $AllowProduction) {
    Deny "production requires the explicit AllowProduction switch"
  }
  if ($ProductionAuthorization -cne $productionPhrase) {
    Deny "production authorization phrase is absent or incorrect"
  }
}

Write-Output ("SUPABASE TARGET VERIFIED: environment={0} project_ref={1} region={2}" -f `
  $resolvedEnvironment.ToUpperInvariant(), $resolvedRef, $expected.region)
exit 0
