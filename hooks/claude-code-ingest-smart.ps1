# Shodh-Cloudflare SMART Auto-Ingest Hook for Claude Code (Windows PowerShell)
#
# Intelligent filtering - only stores valuable conversations
#
# Installation:
#   1. Copy to %USERPROFILE%\.claude\hooks\
#   2. Add to %USERPROFILE%\.claude\settings.json:
#      {
#        "hooks": {
#          "Stop": [{
#            "matcher": "",
#            "hooks": [{
#              "type": "command",
#              "command": "powershell -ExecutionPolicy Bypass -File \"%USERPROFILE%\\.claude\\hooks\\claude-code-ingest-smart.ps1\""
#            }]
#          }]
#        }
#      }
#   3. Set environment variables (see below)
#
# Environment Variables:
#   SHODH_CLOUDFLARE_URL     - Cloudflare Worker URL (required)
#   SHODH_CLOUDFLARE_API_KEY - API key (required)
#   SHODH_MIN_LENGTH         - Minimum content length (default: 300)
#   SHODH_DEBUG              - Set to "1" for debug logging
#
# Explicit Triggers (in user message):
#   #remember  - Force store this exchange
#   #skip      - Skip this exchange

$ErrorActionPreference = "SilentlyContinue"

# ============================================================================
# CONFIGURATION
# ============================================================================

$API_URL = $env:SHODH_CLOUDFLARE_URL
$API_KEY = $env:SHODH_CLOUDFLARE_API_KEY
$MIN_LENGTH = if ($env:SHODH_MIN_LENGTH) { [int]$env:SHODH_MIN_LENGTH } else { 300 }
$DEBUG = $env:SHODH_DEBUG -eq "1"
$LOG_FILE = if ($env:SHODH_LOG_FILE) { $env:SHODH_LOG_FILE } else { "$env:TEMP\shodh-hook.log" }

function Write-Log {
    param([string]$Message)
    if ($DEBUG) {
        $timestamp = Get-Date -Format "HH:mm:ss"
        "[$timestamp] $Message" | Out-File -Append -FilePath $LOG_FILE
    }
}

# ============================================================================
# VALIDATION
# ============================================================================

if (-not $API_URL) {
    Write-Log "ERROR: SHODH_CLOUDFLARE_URL not set"
    exit 0
}

if (-not $API_KEY) {
    Write-Log "ERROR: SHODH_CLOUDFLARE_API_KEY not set"
    exit 0
}

# ============================================================================
# EXTRACT CONVERSATION
# ============================================================================

# Read hook input from stdin
$inputJson = $input | Out-String

if (-not $inputJson) {
    Write-Log "No input received"
    exit 0
}

try {
    $hookInput = $inputJson | ConvertFrom-Json
} catch {
    Write-Log "Failed to parse input JSON"
    exit 0
}

$transcriptPath = $hookInput.transcript_path
$cwd = if ($hookInput.cwd) { $hookInput.cwd } else { "unknown" }
$project = Split-Path -Leaf $cwd

if (-not $transcriptPath -or -not (Test-Path $transcriptPath)) {
    Write-Log "No transcript found: $transcriptPath"
    exit 0
}

try {
    $transcript = Get-Content -Path $transcriptPath -Raw | ConvertFrom-Json
} catch {
    Write-Log "Failed to parse transcript"
    exit 0
}

# Get last 2 messages
$lastMessages = $transcript | Select-Object -Last 2

if ($lastMessages.Count -lt 2) {
    Write-Log "Not enough messages in transcript"
    exit 0
}

# Extract user and assistant messages
$userMsg = ""
$assistantMsg = ""

foreach ($msg in $lastMessages) {
    $text = ""
    if ($msg.content -is [array]) {
        $text = ($msg.content | Where-Object { $_.type -eq "text" } | ForEach-Object { $_.text }) -join " "
    } else {
        $text = [string]$msg.content
    }

    if ($msg.role -eq "user") {
        $userMsg = $text
    } elseif ($msg.role -eq "assistant") {
        $assistantMsg = $text
    }
}

$content = "User: $userMsg`n`nAssistant: $assistantMsg"

# ============================================================================
# EXPLICIT TRIGGERS - User overrides
# ============================================================================

# Force skip if #skip in user message
if ($userMsg -match "#skip") {
    Write-Log "SKIP: User requested #skip"
    exit 0
}

# Force store if #remember in user message
$forceRemember = $userMsg -match "#remember"
if ($forceRemember) {
    Write-Log "FORCE: User requested #remember"
}

# ============================================================================
# SMART FILTERING - Only store valuable content
# ============================================================================

$memoryType = "Observation"
$isValuable = $false

if (-not $forceRemember) {
    # Skip if too short
    if ($content.Length -lt $MIN_LENGTH) {
        Write-Log "SKIP: Too short ($($content.Length) < $MIN_LENGTH)"
        exit 0
    }

    $contentLower = $content.ToLower()

    # Pattern definitions (English + German)
    $patterns = @{
        "Decision" = "(decided|chose|will use|let's go with|i'll use|we'll use|settled on|going with|entschieden|gewählt|nehmen wir|verwenden wir|machen wir|nutzen wir)"
        "Error" = "(error|exception|failed|fixed|bug|issue|crash|broken|resolved|solved|fehler|behoben|gefixt|problem|kaputt|gelöst|repariert)"
        "Learning" = "(learned|discovered|realized|found out|turns out|interestingly|til|gelernt|entdeckt|herausgefunden|stellte sich heraus|interessanterweise)"
        "Implementation" = "(implemented|created|built|added|refactored|set up|configured|deployed|implementiert|erstellt|gebaut|hinzugefügt|konfiguriert|eingerichtet|refaktoriert)"
        "Important" = "(critical|important|remember|note|key|essential|must|never|always|wichtig|merken|notiz|niemals|immer|kritisch|wesentlich|unbedingt)"
        "Code" = "(function|class|component|api|endpoint|database|schema|test|config|funktion|klasse|komponente|datenbank|schnittstelle|konfiguration)"
    }

    # Check patterns in order of importance
    if ($contentLower -match $patterns["Decision"]) {
        $isValuable = $true
        $memoryType = "Decision"
        Write-Log "MATCH: Decision pattern"
    }
    elseif ($contentLower -match $patterns["Error"]) {
        $isValuable = $true
        $memoryType = "Error"
        Write-Log "MATCH: Error pattern"
    }
    elseif ($contentLower -match $patterns["Learning"]) {
        $isValuable = $true
        $memoryType = "Learning"
        Write-Log "MATCH: Learning pattern"
    }
    elseif ($contentLower -match $patterns["Implementation"]) {
        $isValuable = $true
        $memoryType = "Learning"
        Write-Log "MATCH: Implementation pattern"
    }
    elseif ($contentLower -match $patterns["Important"]) {
        $isValuable = $true
        $memoryType = "Context"
        Write-Log "MATCH: Important pattern"
    }
    elseif ($contentLower -match $patterns["Code"]) {
        # Code-related but only if substantial
        if ($content.Length -gt 600) {
            $isValuable = $true
            $memoryType = "Context"
            Write-Log "MATCH: Substantial code discussion"
        }
    }

    if (-not $isValuable) {
        Write-Log "SKIP: No valuable patterns detected"
        exit 0
    }
} else {
    $memoryType = "Context"
}

# ============================================================================
# STORE MEMORY
# ============================================================================

# Truncate if too long
if ($content.Length -gt 4000) {
    $content = $content.Substring(0, 4000) + "..."
}

$tags = @("claude-code", "smart-ingest", $project, $memoryType.ToLower())

$body = @{
    content = $content
    type = $memoryType
    tags = $tags
    source_type = "ai_generated"
} | ConvertTo-Json -Compress

Write-Log "STORING: $memoryType ($($content.Length) chars)"

try {
    $headers = @{
        "Content-Type" = "application/json"
        "X-API-Key" = $API_KEY
    }

    Invoke-RestMethod -Uri "$API_URL/api/remember" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -TimeoutSec 5 | Out-Null

    Write-Log "DONE"
} catch {
    Write-Log "ERROR: Failed to store memory - $_"
}

exit 0
