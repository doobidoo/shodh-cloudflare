#!/bin/bash
# Shodh-Cloudflare Auto-Ingest Hook for Claude Code
#
# This hook runs after each Claude Code response to automatically
# store conversations in shodh-cloudflare for persistent learning.
#
# Installation:
#   1. Copy this file to ~/.claude/hooks/
#   2. Add to ~/.claude/settings.json:
#      {
#        "hooks": {
#          "Stop": [{
#            "matcher": "",
#            "hooks": [{
#              "type": "command",
#              "command": "bash ~/.claude/hooks/claude-code-ingest.sh"
#            }]
#          }]
#        }
#      }
#   3. Set environment variables (see below)
#
# Environment Variables:
#   SHODH_CLOUDFLARE_URL - Cloudflare Worker URL (required)
#   SHODH_CLOUDFLARE_API_KEY - API key (required)
#
# Adapted from: https://github.com/varun29ankuS/shodh-memory

set -e

# API URL - required
if [ -z "$SHODH_CLOUDFLARE_URL" ]; then
    echo "ERROR: SHODH_CLOUDFLARE_URL environment variable not set" >&2
    exit 1
fi
API_URL="$SHODH_CLOUDFLARE_URL"

# API Key - required
if [ -z "$SHODH_CLOUDFLARE_API_KEY" ]; then
    echo "ERROR: SHODH_CLOUDFLARE_API_KEY environment variable not set" >&2
    exit 1
fi
API_KEY="$SHODH_CLOUDFLARE_API_KEY"

# Read hook input from stdin
INPUT=$(cat)

# Extract transcript path from hook input
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    exit 0
fi

# Extract the last exchange (user message + assistant response)
LAST_MESSAGES=$(jq -c '.[-2:]' "$TRANSCRIPT_PATH" 2>/dev/null || echo "[]")

if [ "$LAST_MESSAGES" = "[]" ] || [ "$LAST_MESSAGES" = "null" ]; then
    exit 0
fi

# Format conversation content - extract text from both user and assistant messages
CONTENT=$(echo "$LAST_MESSAGES" | jq -r '
  map(
    if .role == "user" then
      "User: " + (.content | if type == "array" then map(select(.type == "text") | .text) | join("\n") else tostring end)
    elif .role == "assistant" then
      "Assistant: " + (.content | if type == "array" then map(select(.type == "text") | .text) | join("\n") else tostring end)
    else
      empty
    end
  ) | join("\n\n")
' 2>/dev/null || echo "")

# Skip if content is empty or too short (< 50 chars = likely noise)
if [ -z "$CONTENT" ] || [ ${#CONTENT} -lt 50 ]; then
    exit 0
fi

# Truncate if too long (max 4000 chars for a single memory)
if [ ${#CONTENT} -gt 4000 ]; then
    CONTENT="${CONTENT:0:4000}..."
fi

# Escape content for JSON
CONTENT_ESCAPED=$(echo "$CONTENT" | jq -Rs '.')

# Extract project context from working directory
CWD=$(echo "$INPUT" | jq -r '.cwd // "unknown"')
PROJECT=$(basename "$CWD")

# Build tags array as JSON
TAGS=$(jq -nc --arg project "$PROJECT" '["claude-code", "auto-ingest", $project]')

# Send to shodh-cloudflare API (fire and forget, don't block Claude)
curl -s -X POST "$API_URL/api/remember" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    --connect-timeout 2 \
    --max-time 5 \
    -d "{
        \"content\": $CONTENT_ESCAPED,
        \"type\": \"Conversation\",
        \"tags\": $TAGS,
        \"source_type\": \"ai_generated\"
    }" > /dev/null 2>&1 || true

exit 0
