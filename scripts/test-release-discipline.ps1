# Non-production dry-run proofs for A6 release discipline.
$ErrorActionPreference = "Stop"
$main = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $main

$preflight = Join-Path $PSScriptRoot "release-preflight.ps1"
$worktree = Join-Path $PSScriptRoot "release-worktree.ps1"
$guard = Join-Path $PSScriptRoot "supabase-target-guard.ps1"
$dryPath = "C:\dev\tradetools-ai-a6-dryrun"
$branch = "release/a6-discipline-dryrun"

function Assert-Exit([string]$Name, [int]$Expected, [scriptblock]$Call) {
  $global:LASTEXITCODE = 0
  $null = & $Call 2>&1
  $actual = $LASTEXITCODE
  if ($actual -ne $Expected) {
    throw "$Name expected exit $Expected but received $actual"
  }
  Write-Output "PASS $Name"
}

# Snapshot main next version + marker absence
$mainNextBefore = $null
$mainNextPkg = Join-Path $main "node_modules\next\package.json"
if (Test-Path -LiteralPath $mainNextPkg) {
  $mainNextBefore = (Get-Content -LiteralPath $mainNextPkg -Raw | ConvertFrom-Json).version
}
$mainMarker = Join-Path $main "node_modules\.a6-isolation-marker"
if (Test-Path -LiteralPath $mainMarker) { Remove-Item -LiteralPath $mainMarker -Force }

Write-Output "=== A6 release discipline dry-run ==="
Write-Output ("MAIN={0}" -f $main)
Write-Output ("MAIN_NEXT_BEFORE={0}" -f $mainNextBefore)

# Wrong Supabase targeting
Assert-Exit "wrong-env-staging+prod-ref" 1 {
  & $guard -Environment STAGING -ProjectRef rhquhnujjnzjhweypavd
}
Assert-Exit "prod-without-auth" 1 {
  & $guard -Environment PRODUCTION -ProjectRef rhquhnujjnzjhweypavd
}

# Source mode on main with exact SHA
$head = (git rev-parse HEAD).Trim()
Assert-Exit "source-sha-match" 0 {
  & $preflight -Mode Source -ExpectedSha $head -MainCheckoutPath $main -SkipVercelNetwork
}
Assert-Exit "source-sha-mismatch" 1 {
  & $preflight -Mode Source -ExpectedSha "0000000000000000000000000000000000000000" -MainCheckoutPath $main -SkipVercelNetwork
}

# Worktree mode refused on main checkout (isolation — do not require clean; untracked A6 files may exist)
Assert-Exit "worktree-mode-on-main-denied" 1 {
  & $preflight -Mode Worktree -ExpectedSha $head -MainCheckoutPath $main -SkipVercelNetwork
}

# Dirty worktree detection: untracked non-ignored file
$tmpDirty = Join-Path $main "a6-dirty-preflight-marker.txt"
Set-Content -LiteralPath $tmpDirty -Value "dirty" -Encoding ascii
Assert-Exit "dirty-require-clean-denied" 1 {
  & $preflight -Mode Source -ExpectedSha $head -MainCheckoutPath $main -RequireClean -SkipVercelNetwork
}
Remove-Item -LiteralPath $tmpDirty -Force -ErrorAction SilentlyContinue

# Create isolated dry-run worktree from current HEAD
if (Test-Path -LiteralPath $dryPath) {
  & $worktree -Action Remove -Path $dryPath -MainCheckoutPath $main | Out-Null
  # If branch still exists from prior run, delete it
  git branch -D $branch 2>$null | Out-Null
}
Assert-Exit "worktree-create" 0 {
  & $worktree -Action Create -Path $dryPath -Branch $branch -BaseSha $head -MainCheckoutPath $main
}
Assert-Exit "worktree-isolation" 0 {
  & $worktree -Action VerifyIsolation -Path $dryPath -MainCheckoutPath $main
}

# Preflight inside worktree must PASS isolation
Assert-Exit "preflight-in-worktree" 0 {
  Push-Location -LiteralPath $dryPath
  try {
    & $preflight -Mode Worktree -ExpectedSha $head -MainCheckoutPath $main -RequireClean -SkipVercelNetwork `
      -SupabaseEnvironment STAGING -ProjectRef tjtrhdckinjtorgbkirm
  } finally {
    Pop-Location
  }
}

# Isolated marker: write only in worktree node_modules path (create dir without full npm ci)
$wtNm = Join-Path $dryPath "node_modules"
New-Item -ItemType Directory -Force -Path $wtNm | Out-Null
$wtMarker = Join-Path $wtNm ".a6-isolation-marker"
Set-Content -LiteralPath $wtMarker -Value "isolated-only" -Encoding ascii
if (Test-Path -LiteralPath $mainMarker) {
  throw "main node_modules received isolation marker"
}
Write-Output "PASS isolated-marker-absent-from-main"

# Main Next version unchanged
if ($mainNextBefore) {
  $mainNextAfter = (Get-Content -LiteralPath $mainNextPkg -Raw | ConvertFrom-Json).version
  if ($mainNextAfter -ne $mainNextBefore) {
    throw "main next version changed during dry-run"
  }
  Write-Output "PASS main-next-untouched"
} else {
  Write-Output "PASS main-next-untouched (no prior install)"
}

# Classify DATABASE_URL without printing secrets
Assert-Exit "classify-db-url-no-secret-echo" 0 {
  $out = & $preflight -Mode Source -ExpectedSha $head -MainCheckoutPath $main -SkipVercelNetwork -ClassifyDatabaseUrl 2>&1 | Out-String
  if ($out -match 'postgres(ql)?://[^\s]+') { throw "secret-like DATABASE_URL echoed" }
  if ($out -match 'sk_live_|sk_test_|service_role|eyJ') { throw "credential-like token echoed" }
  if ($out -notmatch 'DATABASE_URL_CLASS=') { throw "missing classification line" }
  $out
}

# Cleanup worktree
Assert-Exit "worktree-remove" 0 {
  & $worktree -Action Remove -Path $dryPath -MainCheckoutPath $main
}
git branch -D $branch 2>$null | Out-Null
if (Test-Path -LiteralPath $dryPath) { throw "dry-run worktree path still exists" }
Write-Output "PASS worktree-cleanup"

Write-Output "All A6 release discipline dry-run proofs passed."
exit 0
