<#
.SYNOPSIS
  Fail-closed release / environment preflight for FieldDive (A6 / FD-P1-07).
.DESCRIPTION
  Never prints secrets. Classifies DATABASE_URL by project_ref substring only when present.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Source", "Worktree", "Full")]
  [string]$Mode,

  [string]$ExpectedSha = "",
  [string]$MainCheckoutPath = "",
  [string]$SupabaseEnvironment = "",
  [string]$ProjectRef = "",
  [switch]$AllowProduction,
  [string]$ProductionAuthorization = "",
  [string]$ExpectedVercelProject = "tradetools-ai",
  [switch]$RequireClean,
  [switch]$SkipVercelNetwork,
  [switch]$ClassifyDatabaseUrl
)

$ErrorActionPreference = "Stop"

function Deny([string]$Reason) {
  [Console]::Error.WriteLine("RELEASE PREFLIGHT DENIED: $Reason")
  exit 1
}

function Get-RepoRoot {
  $root = (& git rev-parse --show-toplevel 2>$null)
  if (-not $root) { Deny "not inside a git repository" }
  return (Resolve-Path -LiteralPath $root.Trim()).Path
}

function Normalize-Path([string]$PathValue) {
  return (Resolve-Path -LiteralPath $PathValue).Path.TrimEnd('\', '/').ToLowerInvariant()
}

$repoRoot = Get-RepoRoot
Set-Location -LiteralPath $repoRoot

if (-not $MainCheckoutPath) {
  # Default sibling assumption: canonical main lives at C:\dev\tradetools-ai
  $candidate = "C:\dev\tradetools-ai"
  if (Test-Path -LiteralPath (Join-Path $candidate ".git")) {
    $MainCheckoutPath = $candidate
  } else {
    $MainCheckoutPath = $repoRoot
  }
}

$mainNorm = Normalize-Path $MainCheckoutPath
$hereNorm = Normalize-Path $repoRoot

Write-Output ("RELEASE PREFLIGHT: mode={0} repo={1}" -f $Mode, $repoRoot)

# --- Exact SHA ---
$head = (& git rev-parse HEAD).Trim()
Write-Output ("HEAD={0}" -f $head)
if ($ExpectedSha) {
  $want = (& git rev-parse $ExpectedSha).Trim()
  if ($head -ne $want) {
    Deny ("expected SHA {0} but HEAD is {1}" -f $want, $head)
  }
  Write-Output "SHA_MATCH=PASS"
} else {
  Write-Output "SHA_MATCH=SKIPPED"
}

# --- Clean worktree ---
$status = (& git status --porcelain)
if ($RequireClean) {
  if ($status) { Deny "worktree is dirty; refuse release preflight" }
  Write-Output "CLEAN=PASS"
} else {
  Write-Output ("CLEAN={0}" -f ($(if ($status) { "DIRTY" } else { "CLEAN" })))
}

# --- Isolation ---
if ($Mode -in @("Worktree", "Full")) {
  if ($hereNorm -eq $mainNorm) {
    Deny "Worktree/Full mode refused: current repo IS the main checkout; use an isolated release worktree"
  }
  Write-Output "ISOLATION=PASS"
} else {
  Write-Output "ISOLATION=N/A_SOURCE_MODE"
}

# --- Node engines ---
$pkgPath = Join-Path $repoRoot "package.json"
if (-not (Test-Path -LiteralPath $pkgPath)) { Deny "package.json missing" }
$pkg = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
$nodeRange = $pkg.engines.node
$nodeVer = (node -v).Trim().TrimStart('v')
Write-Output ("NODE={0} ENGINES={1}" -f $nodeVer, $nodeRange)
if ($nodeRange -match '>=(\d+).*?<(\d+)') {
  $min = [int]$Matches[1]
  $max = [int]$Matches[2]
  $major = [int]($nodeVer.Split('.')[0])
  if ($major -lt $min -or $major -ge $max) {
    Deny ("Node {0} outside engines {1}" -f $nodeVer, $nodeRange)
  }
  Write-Output "NODE_ENGINES=PASS"
} else {
  Deny "package.json engines.node is missing or unparsable"
}

# --- Next declared version ---
$nextDecl = [string]$pkg.dependencies.next
if (-not $nextDecl) { Deny "package.json dependencies.next missing" }
Write-Output ("NEXT_DECLARED={0}" -f $nextDecl)
$nextInstalledPath = Join-Path $repoRoot "node_modules\next\package.json"
if (Test-Path -LiteralPath $nextInstalledPath) {
  $nextInstalled = (Get-Content -LiteralPath $nextInstalledPath -Raw | ConvertFrom-Json).version
  Write-Output ("NEXT_INSTALLED={0}" -f $nextInstalled)
} else {
  Write-Output "NEXT_INSTALLED=ABSENT"
}

# --- package-lock ---
$lockPath = Join-Path $repoRoot "package-lock.json"
if (-not (Test-Path -LiteralPath $lockPath)) { Deny "package-lock.json missing" }
Write-Output "PACKAGE_LOCK=PASS"

# --- Protect main runtime paths (advisory verify) ---
$mainNm = Join-Path $MainCheckoutPath "node_modules"
$mainNext = Join-Path $MainCheckoutPath ".next"
Write-Output ("MAIN_NODE_MODULES_EXISTS={0}" -f (Test-Path -LiteralPath $mainNm))
Write-Output ("MAIN_DOTNEXT_EXISTS={0}" -f (Test-Path -LiteralPath $mainNext))
if ($Mode -in @("Worktree", "Full")) {
  $wtNm = Join-Path $repoRoot "node_modules"
  if ((Test-Path -LiteralPath $wtNm) -and (Normalize-Path $wtNm) -eq (Normalize-Path $mainNm)) {
    Deny "release node_modules resolves to main checkout node_modules"
  }
}

# --- Supabase target ---
if ($SupabaseEnvironment -and $ProjectRef) {
  $guard = Join-Path $PSScriptRoot "supabase-target-guard.ps1"
  $guardArgs = @{
    Environment = $SupabaseEnvironment
    ProjectRef  = $ProjectRef
  }
  if ($AllowProduction) {
    $guardArgs.AllowProduction = $true
    $guardArgs.ProductionAuthorization = $ProductionAuthorization
  }
  & $guard @guardArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Output "SUPABASE_TARGET=PASS"
} elseif ($Mode -eq "Full") {
  Deny "Full mode requires -SupabaseEnvironment and -ProjectRef"
} else {
  Write-Output "SUPABASE_TARGET=SKIPPED"
}

# --- DATABASE_URL classification (no secret print) ---
if ($ClassifyDatabaseUrl) {
  $envLocal = Join-Path $MainCheckoutPath ".env.local"
  if (-not (Test-Path -LiteralPath $envLocal)) {
    Write-Output "DATABASE_URL_CLASS=ABSENT"
  } else {
    $raw = Get-Content -LiteralPath $envLocal -Raw
    $m = [regex]::Match($raw, '(?m)^DATABASE_URL=(.*)$')
    if (-not $m.Success) {
      Write-Output "DATABASE_URL_CLASS=ABSENT"
    } else {
      $val = $m.Groups[1].Value.Trim().Trim('"').Trim("'")
      $class = "UNKNOWN"
      if ($val -match 'rhquhnujjnzjhweypavd') { $class = "PRODUCTION" }
      elseif ($val -match 'tjtrhdckinjtorgbkirm') { $class = "STAGING" }
      elseif ($val -match 'localhost|127\.0\.0\.1') { $class = "LOCAL" }
      Write-Output ("DATABASE_URL_CLASS={0}" -f $class)
      # Never Write-Output the value
    }
  }
}

# --- Vercel project (optional network) ---
if (-not $SkipVercelNetwork -and $Mode -eq "Full") {
  $projFile = Join-Path $repoRoot ".vercel\project.json"
  if (Test-Path -LiteralPath $projFile) {
    $proj = Get-Content -LiteralPath $projFile -Raw | ConvertFrom-Json
    $name = [string]$proj.projectName
    if ($name -and $name -ne $ExpectedVercelProject) {
      Deny ("Vercel projectName {0} != expected {1}" -f $name, $ExpectedVercelProject)
    }
    Write-Output ("VERCEL_PROJECT={0}" -f ($(if ($name) { $name } else { "UNSET" })))
  } else {
    Write-Output "VERCEL_PROJECT=NO_LOCAL_LINK_FILE"
  }
} else {
  Write-Output ("VERCEL_PROJECT_EXPECTED={0}" -f $ExpectedVercelProject)
}

Write-Output "RELEASE PREFLIGHT PASS"
exit 0
