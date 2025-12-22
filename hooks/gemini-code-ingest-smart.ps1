
# Shodh-Cloudflare SMART Auto-Ingest Hook for a Gemini Client
#
# PowerShell equivalent of the smart ingest hook.
#
# Intelligent filtering - only stores valuable conversations:
# - Decisions, errors, learnings, implementations
# - Explicit #remember trigger
# - Skips trivial exchanges, questions, small talk
#
# Installation:
#   1. This script should be invoked by your Gemini client application after a response is received.
#   2. The client must pass the path to the JSON transcript as the first argument.
#   3. The following environment variables must be set:
#      - SHODH_CLOUDFLARE_URL: The URL to your Shodh Cloudflare worker.
#      - SHODH_CLOUDFLARE_API_KEY: The API key for your worker.
#
# Explicit Triggers (in user message):
#   #remember  - Force store this exchange
#   #skip      - Skip this exchange (even if it seems valuable)

param (
    [string]$TranscriptPath
)

# --- Configuration ---
$ApiUrl = $env:SHODH_CLOUDFLARE_URL
$ApiKey = $env:SHODH_CLOUDFLARE_API_KEY
$MinLength = [int]($env:SHODH_MIN_LENGTH | Out-String -Default 300).Trim()
$IsDebug = [bool]($env:SHODH_DEBUG -eq '1')
$LogFile = $env:SHODH_LOG_FILE | Out-String -Default "$env:TEMP/shodh-gemini-hook.log"

# --- Logging Function ---
function Write-Log {
    param ([string]$Message)
    if ($IsDebug) {
        $timestamp = Get-Date -Format 'HH:mm:ss'
        "[$timestamp] $Message" | Out-File -Append -FilePath $LogFile
    }
}

# --- Pre-flight Checks ---
if ([string]::IsNullOrEmpty($ApiUrl) -or [string]::IsNullOrEmpty($ApiKey)) {
    Write-Log "EXIT: API URL or Key not set."
    exit 0
}

if (-not (Test-Path -Path $TranscriptPath -PathType Leaf)) {
    Write-Log "EXIT: Transcript file not found at '$TranscriptPath'."
    exit 0
}

# --- Read and Parse Transcript ---
try {
    $transcript = Get-Content -Path $TranscriptPath -Raw | ConvertFrom-Json
}
catch {
    Write-Log "EXIT: Failed to parse JSON from '$TranscriptPath'."
    exit 0
}

if ($transcript.Count -lt 2) {
    Write-Log "EXIT: Not enough messages in transcript to form a pair."
    exit 0
}

# Assume last two messages are the user and model turn
$lastMessages = $transcript[-2..-1]
$userMsgObj = $lastMessages | Where-Object { $_.role -eq 'user' } | Select-Object -First 1
$modelMsgObj = $lastMessages | Where-Object { $_.role -eq 'model' } | Select-Object -First 1

# Handle complex content (arrays of parts) vs simple strings
$userMsg = if ($userMsgObj.content -is [array]) { ($userMsgObj.content | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join ' ' } else { $userMsgObj.content }
$modelMsg = if ($modelMsgObj.content -is [array]) { ($modelMsgObj.content | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join ' ' } else { $modelMsgObj.content }

$Content = "User: $userMsg`n`nModel: $modelMsg"
$Cwd = (Get-Location).Path
$Project = Split-Path -Leaf $Cwd

# --- Explicit Triggers ---
$forceRemember = $false
if ($userMsg -match '#skip') {
    Write-Log "SKIP: User requested #skip."
    exit 0
}
if ($userMsg -match '#remember') {
    $forceRemember = $true
    Write-Log "FORCE: User requested #remember."
}

# --- Smart Filtering ---
if (-not $forceRemember) {
    if ($Content.Length -lt $MinLength) {
        Write-Log "SKIP: Too short ($($Content.Length) < $MinLength)."
        exit 0
    }

    # Patterns that indicate valuable content (English + German)
    $decisionPatterns = "(decided|chose|will use|let's go with|i'll use|we'll use|settled on|going with|entschieden|gewählt|nehmen wir|verwenden wir|machen wir|nutzen wir)"
    $errorPatterns = "(error|exception|failed|fixed|bug|issue|crash|broken|resolved|solved|fehler|behoben|gefixt|problem|kaputt|gelöst|repariert)"
    $learningPatterns = "(learned|discovered|realized|found out|turns out|interestingly|til|gelernt|entdeckt|herausgefunden|stellte sich heraus|interessanterweise)"
    $implementPatterns = "(implemented|created|built|added|refactored|set up|configured|deployed|implementiert|erstellt|gebaut|hinzugefügt|konfiguriert|eingerichtet|refaktoriert)"
    $importantPatterns = "(critical|important|remember|note|key|essential|must|never|always|wichtig|merken|notiz|niemals|immer|kritisch|wesentlich|unbedingt)"
    $codePatterns = "(function|class|component|api|endpoint|database|schema|test|config|funktion|klasse|komponente|datenbank|schnittstelle|konfiguration)"

    $contentLower = $Content.ToLower()
    $isValuable = $false
    $memoryType = "Observation"

    if ($contentLower -match $decisionPatterns) { $isValuable = $true; $memoryType = "Decision"; Write-Log "MATCH: Decision pattern" }
    elseif ($contentLower -match $errorPatterns) { $isValuable = $true; $memoryType = "Error"; Write-Log "MATCH: Error pattern" }
    elseif ($contentLower -match $learningPatterns) { $isValuable = $true; $memoryType = "Learning"; Write-Log "MATCH: Learning pattern" }
    elseif ($contentLower -match $implementPatterns) { $isValuable = $true; $memoryType = "Learning"; Write-Log "MATCH: Implementation pattern" }
    elseif ($contentLower -match $importantPatterns) { $isValuable = $true; $memoryType = "Context"; Write-Log "MATCH: Important pattern" }
    elseif ($contentLower -match $codePatterns -and $Content.Length -gt 600) { $isValuable = $true; $memoryType = "Context"; Write-Log "MATCH: Substantial code discussion" }

    if (-not $isValuable) {
        Write-Log "SKIP: No valuable patterns detected."
        exit 0
    }
}
else {
    $memoryType = "Context"
}

# --- Store Memory ---
if ($Content.Length -gt 4000) {
    $Content = "$($Content.Substring(0, 4000))..."
}

$tags = @("gemini-cli", "smart-ingest", $Project, $memoryType.ToLower())

$payload = [PSCustomObject]@{
    content     = $Content
    type        = $memoryType
    tags        = $tags
    source_type = "ai_generated"
}
$jsonPayload = $payload | ConvertTo-Json -Depth 3

$headers = @{
    "Content-Type" = "application/json"
    "X-API-Key"    = $ApiKey
}

Write-Log "STORING: $memoryType ($($Content.Length) chars)"

try {
    Invoke-RestMethod -Uri "$ApiUrl/api/remember" -Method Post -Body $jsonPayload -Headers $headers -TimeoutSec 5 -SkipHttpErrorCheck
}
catch {
    Write-Log "ERROR: Failed to call remember API. $_"
}

Write-Log "DONE"
exit 0
