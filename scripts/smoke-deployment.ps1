# Run from the repository root after `npx supabase login` and deployment.
# Creates a temporary session for the already-confirmed, allowed user without sending
# an email or reading their password. Credentials stay in memory and are not printed.
$ErrorActionPreference = 'Stop'
$sessionToken = $null
$baseUrl = $null
$publicKey = $null

function Read-LocalSettings([string]$Path) {
  $values = @{}
  foreach ($line in [System.IO.File]::ReadAllLines((Join-Path (Get-Location) $Path))) {
    if ($line -match '^([A-Z_]+)=(.*)$') { $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'") }
  }
  return $values
}

try {
  $mobile = Read-LocalSettings 'mobile/.env.local'
  $server = Read-LocalSettings 'supabase/.env.local'
  $baseUrl = $mobile['EXPO_PUBLIC_SUPABASE_URL'].TrimEnd('/')
  $publicKey = $mobile['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
  $ownerId = $server['ALLOWED_USER_ID']
  if ($baseUrl -notmatch '^https://[a-z]{20}\.supabase\.co$' -or $ownerId -notmatch '^[0-9a-fA-F-]{36}$') {
    throw 'Invalid project URL or allowed user UUID.'
  }
  $projectRef = ([uri]$baseUrl).Host.Split('.')[0]
  $rawKeys = & npx --yes supabase projects api-keys "--remote=$projectRef" --reveal --output json 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Could not access the project authentication keys.' }
  $keyList = ($rawKeys -join "`n") | ConvertFrom-Json
  $adminKey = ($keyList | Where-Object name -eq 'service_role' | Select-Object -First 1).api_key
  if (-not $adminKey) { throw 'The project service key is unavailable.' }
  $adminHeaders = @{ apikey = $adminKey; Authorization = "Bearer $adminKey" }
  $user = Invoke-RestMethod -Uri "$baseUrl/auth/v1/admin/users/$ownerId" -Headers $adminHeaders -TimeoutSec 15
  if ($user.id -ne $ownerId -or -not $user.email_confirmed_at -or -not $user.email) {
    throw 'The allowed account must exist and already have a confirmed email.'
  }
  $linkBody = @{ type = 'magiclink'; email = $user.email } | ConvertTo-Json
  $link = Invoke-RestMethod -Uri "$baseUrl/auth/v1/admin/generate_link" -Method Post -Headers $adminHeaders -ContentType 'application/json' -Body $linkBody -TimeoutSec 15
  $tokenHash = $link.hashed_token
  if (-not $tokenHash) { $tokenHash = $link.properties.hashed_token }
  if (-not $tokenHash) { throw 'Could not generate a temporary test login.' }
  $verifyBody = @{ type = 'magiclink'; token_hash = $tokenHash } | ConvertTo-Json
  $session = Invoke-RestMethod -Uri "$baseUrl/auth/v1/verify" -Method Post -Headers @{ apikey = $publicKey } -ContentType 'application/json' -Body $verifyBody -TimeoutSec 15
  $sessionToken = $session.access_token
  if (-not $sessionToken -or $session.user.id -ne $ownerId) { throw 'Could not authenticate the allowed test account.' }
  $headers = @{ apikey = $publicKey; Authorization = "Bearer $sessionToken" }
  foreach ($gymAvailable in @($false, $true)) {
    $body = @{ bodyParts = @('legs'); gymAvailable = $gymAvailable } | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "$baseUrl/functions/v1/generate-menu" -Method Post -Headers $headers -ContentType 'application/json' -Body $body -SkipHttpErrorCheck -TimeoutSec 75
    $payload = $response.Content | ConvertFrom-Json
    if ([int]$response.StatusCode -ne 200) {
      [pscustomobject]@{ Check = 'Live Gemini proposal'; GymAvailable = $gymAvailable; Status = [int]$response.StatusCode; ErrorCode = $payload.error.code } | ConvertTo-Json
      throw 'Live generation failed. No credential or upstream error body was printed.'
    }
    if (-not $payload.menu.items -or $payload.menu.items.Count -lt 2) { throw 'No valid menu was returned.' }
    [pscustomobject]@{ Check = 'Live Gemini proposal'; GymAvailable = $gymAvailable; Status = [int]$response.StatusCode; ItemCount = $payload.menu.items.Count; ExerciseIds = @($payload.menu.items.exerciseId) } | ConvertTo-Json -Depth 3
  }
} catch {
  # Do not dump HTTP exception objects, headers, raw CLI output, or link/session bodies.
  Write-Output 'Deployment smoke test did not finish successfully.'
  exit 1
} finally {
  if ($sessionToken -and $baseUrl -and $publicKey) {
    try {
      $null = Invoke-WebRequest -Uri "$baseUrl/auth/v1/logout?scope=local" -Method Post -Headers @{ apikey = $publicKey; Authorization = "Bearer $sessionToken" } -SkipHttpErrorCheck -TimeoutSec 15
      Write-Output 'Temporary test session signed out.'
    } catch { Write-Output 'Temporary test session could not be signed out; its token was not saved.' }
  }
}
