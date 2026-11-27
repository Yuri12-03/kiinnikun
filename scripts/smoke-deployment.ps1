# Run from the repository root after `npx supabase login` and deployment.
# Creates a temporary session for the already-confirmed, allowed user without sending
# an email or reading their password. Credentials stay in memory and are not printed.
param([switch]$ReplacementOnly, [switch]$DurationOnly)
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
  if ($DurationOnly) {
    foreach ($durationMinutes in @(10, 30)) {
      $conditions = @{ bodyParts = @('legs'); gymAvailable = $true; durationMinutes = $durationMinutes }
      $response = Invoke-WebRequest -Uri "$baseUrl/functions/v1/generate-menu" -Method Post -Headers $headers -ContentType 'application/json' -Body ($conditions | ConvertTo-Json) -SkipHttpErrorCheck -TimeoutSec 75
      $payload = $response.Content | ConvertFrom-Json
      if ([int]$response.StatusCode -ne 200) { throw "Duration generation failed: HTTP $([int]$response.StatusCode), $($payload.error.code)" }
      $seconds = 0
      foreach ($entry in $payload.menu.items) { $seconds += $entry.sets * $entry.reps * 4 + [Math]::Max(0, $entry.sets - 1) * $entry.restSeconds + 60 }
      $estimated = [Math]::Ceiling($seconds / 60)
      $legIds = @('squat', 'glute-bridge', 'calf-raise', 'leg-press', 'leg-curl', 'leg-extension', 'good-morning', 'shallow-squat')
      if (@($payload.menu.items).Count -lt 2 -or @($payload.menu.items.exerciseId | Where-Object { $_ -notin $legIds }).Count -gt 0 -or $estimated -gt $durationMinutes) { throw 'Invalid duration-based menu.' }
      [pscustomobject]@{ Check = 'Live Gemini duration'; RequestedMinutes = $durationMinutes; EstimatedMinutes = $estimated; ExerciseCount = @($payload.menu.items).Count; Sets = @($payload.menu.items.sets) } | ConvertTo-Json -Compress
      New-Item -ItemType Directory -Path artifacts -Force | Out-Null
      @{ conditions = $conditions; menu = $payload.menu } | ConvertTo-Json -Depth 8 | Set-Content "artifacts/duration-$durationMinutes.json"
    }
  } elseif ($ReplacementOnly) {
    $first = @{ exerciseId = 'leg-press'; sets = 2; reps = 10; restSeconds = 60; reason = '脚の種目' }
    $second = @{ exerciseId = 'glute-bridge'; sets = 2; reps = 10; restSeconds = 60; reason = 'お尻の種目' }
    $replacement = @{ conditions = @{ bodyParts = @('legs'); gymAvailable = $true }; menu = @{ summary = '脚のメニュー'; items = @($first, $second) }; targetExerciseId = 'leg-press'; reason = 'equipment_busy'; exclusions = @{ equipment = @(); exerciseIds = @() } }
    $response = Invoke-WebRequest -Uri "$baseUrl/functions/v1/replace-exercise" -Method Post -Headers $headers -ContentType 'application/json' -Body ($replacement | ConvertTo-Json -Depth 8) -SkipHttpErrorCheck -TimeoutSec 75
    $payload = $response.Content | ConvertFrom-Json
    [pscustomobject]@{ Check = 'Live Gemini replacement'; Status = [int]$response.StatusCode; CandidateCount = @($payload.candidates).Count; ExerciseIds = @($payload.candidates.exerciseId); ErrorCode = $payload.error.code } | ConvertTo-Json -Depth 3
    if ([int]$response.StatusCode -ne 200 -or @($payload.candidates).Count -lt 1 -or @($payload.candidates.exerciseId | Where-Object { $_ -notin @('squat', 'shallow-squat', 'leg-extension') }).Count -gt 0) { throw 'Invalid live replacement result.' }
    $replacement.menu.items = @(@{ exerciseId = 'calf-raise'; sets = 2; reps = 10; restSeconds = 60; reason = 'ふくらはぎの種目' }, $second)
    $replacement.targetExerciseId = 'calf-raise'; $replacement.reason = 'too_difficult'
    $empty = Invoke-WebRequest -Uri "$baseUrl/functions/v1/replace-exercise" -Method Post -Headers $headers -ContentType 'application/json' -Body ($replacement | ConvertTo-Json -Depth 8) -SkipHttpErrorCheck -TimeoutSec 30
    $emptyPayload = $empty.Content | ConvertFrom-Json
    if ([int]$empty.StatusCode -ne 200 -or @($emptyPayload.candidates).Count -ne 0) { throw 'No-candidate check failed.' }
    Write-Output 'No-candidate response returned an empty list.'
  } else { foreach ($gymAvailable in @($false, $true)) {
    $body = @{ bodyParts = @('legs'); gymAvailable = $gymAvailable } | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "$baseUrl/functions/v1/generate-menu" -Method Post -Headers $headers -ContentType 'application/json' -Body $body -SkipHttpErrorCheck -TimeoutSec 75
    $payload = $response.Content | ConvertFrom-Json
    if ([int]$response.StatusCode -ne 200) {
      [pscustomobject]@{ Check = 'Live Gemini proposal'; GymAvailable = $gymAvailable; Status = [int]$response.StatusCode; ErrorCode = $payload.error.code } | ConvertTo-Json
      throw 'Live generation failed. No credential or upstream error body was printed.'
    }
    if (-not $payload.menu.items -or $payload.menu.items.Count -lt 2) { throw 'No valid menu was returned.' }
    [pscustomobject]@{ Check = 'Live Gemini proposal'; GymAvailable = $gymAvailable; Status = [int]$response.StatusCode; ItemCount = $payload.menu.items.Count; ExerciseIds = @($payload.menu.items.exerciseId) } | ConvertTo-Json -Depth 3
  } }
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
