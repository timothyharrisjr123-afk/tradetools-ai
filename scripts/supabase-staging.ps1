[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Verify", "Link", "MigrationStatus", "DryRun", "ApplyPending", "PostApplyHelp")]
  [string]$Action,
  [Parameter(Mandatory = $true)] [string]$ProjectRef,
  [switch]$ConfirmStagingApply,
  [string]$StagingApplyAuthorization = ""
)

$ErrorActionPreference = "Stop"
$guardPath = Join-Path $PSScriptRoot "supabase-target-guard.ps1"
$applyPhrase = "APPLY_FIELD_DIVE_STAGING_MIGRATIONS_tjtrhdckinjtorgbkirm"

& $guardPath -Environment STAGING -ProjectRef $ProjectRef
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($Action -eq "Verify") { exit 0 }

if ($Action -ne "Link") {
  $linkedRefPath = Join-Path $PSScriptRoot "..\supabase\.temp\project-ref"
  if (-not (Test-Path -LiteralPath $linkedRefPath -PathType Leaf)) {
    [Console]::Error.WriteLine("SUPABASE TARGET DENIED: CLI link is missing; link staging first")
    exit 1
  }
  $linkedRef = (Get-Content -LiteralPath $linkedRefPath -Raw).Trim()
  if ($linkedRef -ne $ProjectRef) {
    [Console]::Error.WriteLine("SUPABASE TARGET DENIED: CLI link does not match verified staging ref")
    exit 1
  }
}

Write-Output "SUPABASE STAGING ACTION: $Action project_ref=$ProjectRef"
switch ($Action) {
  "Link" {
    & npx.cmd --yes supabase link --project-ref $ProjectRef
  }
  "MigrationStatus" {
    & npx.cmd --yes supabase migration list --project-ref $ProjectRef
  }
  "DryRun" {
    & npx.cmd --yes supabase db push --dry-run --skip-vault --project-ref $ProjectRef
  }
  "ApplyPending" {
    if (-not $ConfirmStagingApply -or $StagingApplyAuthorization -cne $applyPhrase) {
      [Console]::Error.WriteLine("SUPABASE TARGET DENIED: staging apply requires both explicit controls")
      exit 1
    }
    & npx.cmd --yes supabase db push --skip-vault --project-ref $ProjectRef
  }
  "PostApplyHelp" {
    Write-Output "Post-apply verification requires the separately authorized catalog/RPC test gate."
  }
}
exit $LASTEXITCODE
