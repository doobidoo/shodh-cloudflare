#!/bin/bash
# Shodh-Cloudflare SMART Auto-Ingest Hook for Claude Code
#
# Intelligent filtering - only stores valuable conversations:
# - Decisions, errors, learnings, implementations
# - Explicit #remember trigger
# - Skips trivial exchanges, questions, small talk
#
# Installation:
#   1. Copy to ~/.claude/hooks/
#   2. Add to ~/.claude/settings.json (see README)
#   3. Set SHODH_CLOUDFLARE_URL and SHODH_CLOUDFLARE_API_KEY
#
# Explicit Triggers (in user message):
#   #remember  - Force store this exchange
#   #skip      - Skip this exchange (even if valuable)

set -e

API_URL="${SHODH_CLOUDFLARE_URL:-}"
API_KEY="${SHODH_CLOUDFLARE_API_KEY:-}"
MIN_LENGTH="${SHODH_MIN_LENGTH:-300}"
DEBUG="${SHODH_DEBUG:-0}"
LOG_FILE="${SHODH_LOG_FILE:-/tmp/shodh-hook.log}"

log() { [ "$DEBUG" = "1" ] && echo "[$(date '+%H:%M:%S')] $1" >> "$LOG_FILE" || true; }

[ -z "$API_URL" ] && exit 0
[ -z "$API_KEY" ] && exit 0

INPUT=$(cat)
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
[ -z "$TRANSCRIPT_PATH" ] && exit 0
[ ! -f "$TRANSCRIPT_PATH" ] && exit 0

LAST_MESSAGES=$(jq -c '.[-2:]' "$TRANSCRIPT_PATH" 2>/dev/null || echo "[]")
[ "$LAST_MESSAGES" = "[]" ] && exit 0

USER_MSG=$(echo "$LAST_MESSAGES" | jq -r 'map(select(.role == "user")) | .[0].content | if type == "array" then map(select(.type == "text") | .text) | join(" ") else tostring end' 2>/dev/null || echo "")
ASSISTANT_MSG=$(echo "$LAST_MESSAGES" | jq -r 'map(select(.role == "assistant")) | .[0].content | if type == "array" then map(select(.type == "text") | .text) | join(" ") else tostring end' 2>/dev/null || echo "")

CONTENT="User: $USER_MSG

Assistant: $ASSISTANT_MSG"

CWD=$(echo "$INPUT" | jq -r '.cwd // "unknown"')
PROJECT=$(basename "$CWD")

# =======================================================================
# EXPLICIT TRIGGERS - User overrides
# =======================================================================

# Force skip if #skip in user message
if echo "$USER_MSG" | grep -qi "#skip"; then
    log "SKIP: User requested #skip"
    exit 0
fi

# Force store if #remember in user message
FORCE_REMEMBER=false
if echo "$USER_MSG" | grep -qi "#remember"; then
    FORCE_REMEMBER=true
    log "FORCE: User requested #remember"
fi

# =======================================================================
# SMART FILTERING - Only store valuable content
# =======================================================================

if [ "$FORCE_REMEMBER" != "true" ]; then
    # Skip if too short (likely trivial)
    if [ ${#CONTENT} -lt "$MIN_LENGTH" ]; then
        log "SKIP: Too short (${#CONTENT} < $MIN_LENGTH)"
        exit 0
    fi

    # Patterns that indicate valuable content (English + German)
    DECISION_PATTERNS="(decided|chose|will use|let's go with|i'll use|we'll use|settled on|going with|entschieden|gewählt|nehmen wir|verwenden wir|machen wir|nutzen wir)"
    ERROR_PATTERNS="(error|exception|failed|fixed|bug|issue|crash|broken|resolved|solved|fehler|behoben|gefixt|problem|kaputt|gelöst|repariert)"
    LEARNING_PATTERNS="(learned|discovered|realized|found out|turns out|interestingly|til|gelernt|entdeckt|herausgefunden|stellte sich heraus|interessanterweise)"
    IMPLEMENT_PATTERNS="(implemented|created|built|added|refactored|set up|configured|deployed|implementiert|erstellt|gebaut|hinzugefügt|konfiguriert|eingerichtet|refaktoriert)"
    IMPORTANT_PATTERNS="(critical|important|remember|note|key|essential|must|never|always|wichtig|merken|notiz|niemals|immer|kritisch|wesentlich|unbedingt)"
    CODE_PATTERNS="(function|class|component|api|endpoint|database|schema|test|config|funktion|klasse|komponente|datenbank|schnittstelle|konfiguration)"

    CONTENT_LOWER=$(echo "$CONTENT" | tr '[A-Z]' '[a-z]')
    
    IS_VALUABLE=false
    MEMORY_TYPE="Observation"

    if echo "$CONTENT_LOWER" | grep -qE "$DECISION_PATTERNS"; then
        IS_VALUABLE=true
        MEMORY_TYPE="Decision"
        log "MATCH: Decision pattern"
    elif echo "$CONTENT_LOWER" | grep -qE "$ERROR_PATTERNS"; then
        IS_VALUABLE=true
        MEMORY_TYPE="Error"
        log "MATCH: Error pattern"
    elif echo "$CONTENT_LOWER" | grep -qE "$LEARNING_PATTERNS"; then
        IS_VALUABLE=true
        MEMORY_TYPE="Learning"
        log "MATCH: Learning pattern"
    elif echo "$CONTENT_LOWER" | grep -qE "$IMPLEMENT_PATTERNS"; then
        IS_VALUABLE=true
        MEMORY_TYPE="Learning"
        log "MATCH: Implementation pattern"
    elif echo "$CONTENT_LOWER" | grep -qE "$IMPORTANT_PATTERNS"; then
        IS_VALUABLE=true
        MEMORY_TYPE="Context"
        log "MATCH: Important pattern"
    elif echo "$CONTENT_LOWER" | grep -qE "$CODE_PATTERNS"; then
        # Code-related but only if substantial (longer)
        if [ ${#CONTENT} -gt 600 ]; then
            IS_VALUABLE=true
            MEMORY_TYPE="Context"
            log "MATCH: Substantial code discussion"
        fi
    fi

    if [ "$IS_VALUABLE" != "true" ]; then
        log "SKIP: No valuable patterns detected"
        exit 0
    fi
else
    MEMORY_TYPE="Context"
fi

# =======================================================================
# STORE MEMORY
# =======================================================================

# Truncate if too long
if [ ${#CONTENT} -gt 4000 ]; then
    CONTENT="${CONTENT:0:4000}..."
fi

CONTENT_ESCAPED=$(echo "$CONTENT" | jq -Rs '.')
TAGS=$(jq -nc --arg project "$PROJECT" --arg type "$MEMORY_TYPE" '["claude-code", "smart-ingest", $project, ($type | ascii_downcase)]')

log "STORING: $MEMORY_TYPE (${#CONTENT} chars)"

curl -s -X POST "$API_URL/api/remember" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    --connect-timeout 2 \
    --max-time 5 \
    -d "{\"content\": $CONTENT_ESCAPED, \"type\": \"$MEMORY_TYPE\", \"tags\": $TAGS, \"source_type\": \"ai_generated\"}" > /dev/null 2>&1 || true

log "DONE"
exit 0
