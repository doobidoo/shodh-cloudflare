# Shodh Cloudflare Hooks

Claude Code hooks for automatic conversation ingestion into Shodh Cloudflare.

## Available Hooks

### `claude-code-ingest-smart.sh` (Recommended)

**Intelligent filtering** - Only stores valuable conversations, not every exchange.

**What triggers storage:**
- Decisions ("decided to use", "let's go with", "chose")
- Errors and fixes ("error", "fixed", "bug", "resolved")
- Learnings ("learned", "discovered", "turns out")
- Implementations ("implemented", "created", "built", "deployed")
- Important notes ("critical", "important", "remember", "must")
- Substantial code discussions (600+ chars with code keywords)

**User overrides:**
- `#remember` in your message - Force store this exchange
- `#skip` in your message - Force skip this exchange

**Auto-assigned memory types:**
| Pattern | Memory Type |
|---------|-------------|
| Decision keywords | `Decision` |
| Error keywords | `Error` |
| Learning keywords | `Learning` |
| Implementation keywords | `Learning` |
| Important keywords | `Context` |
| Code discussion | `Context` |

**Tags:** `claude-code`, `smart-ingest`, `<project>`, `<type>`

---

### `claude-code-ingest.sh` (Basic)

Stores **every** conversation (not recommended for heavy use).

**What it captures:**
- Last user message + assistant response
- Project context (working directory)
- Auto-tags: `claude-code`, `auto-ingest`, `<project-name>`

## Installation

### Linux/macOS

#### 1. Copy the hook script

```bash
mkdir -p ~/.claude/hooks

# Smart hook (recommended)
cp hooks/claude-code-ingest-smart.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/claude-code-ingest-smart.sh
```

#### 2. Configure Claude Code settings

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "bash ~/.claude/hooks/claude-code-ingest-smart.sh"
      }]
    }]
  }
}
```

#### 3. Set environment variables

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
# Required
export SHODH_CLOUDFLARE_URL="https://your-worker.your-subdomain.workers.dev"
export SHODH_CLOUDFLARE_API_KEY="your-api-key"

# Optional
export SHODH_MIN_LENGTH=300     # Minimum content length (default: 300)
export SHODH_DEBUG=1            # Enable debug logging
export SHODH_LOG_FILE=/tmp/shodh-hook.log  # Log file path
```

---

### Windows (PowerShell)

#### 1. Copy the hook script

```powershell
# Create hooks directory
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\hooks"

# Copy smart hook
Copy-Item "hooks\claude-code-ingest-smart.ps1" "$env:USERPROFILE\.claude\hooks\"
```

#### 2. Configure Claude Code settings

Add to `%USERPROFILE%\.claude\settings.json`:

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "powershell -ExecutionPolicy Bypass -File \"%USERPROFILE%\\.claude\\hooks\\claude-code-ingest-smart.ps1\""
      }]
    }]
  }
}
```

#### 3. Set environment variables

**Option A: User environment variables (persistent)**

```powershell
[Environment]::SetEnvironmentVariable("SHODH_CLOUDFLARE_URL", "https://your-worker.workers.dev", "User")
[Environment]::SetEnvironmentVariable("SHODH_CLOUDFLARE_API_KEY", "your-api-key", "User")

# Optional
[Environment]::SetEnvironmentVariable("SHODH_MIN_LENGTH", "300", "User")
[Environment]::SetEnvironmentVariable("SHODH_DEBUG", "1", "User")
```

**Option B: System Settings**
1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Go to "Advanced" → "Environment Variables"
3. Add user variables:
   - `SHODH_CLOUDFLARE_URL` = `https://your-worker.workers.dev`
   - `SHODH_CLOUDFLARE_API_KEY` = `your-api-key`

**Note:** Restart Claude Code after setting environment variables.

## Requirements

### Linux/macOS (Bash)
- `jq` - JSON processor
- `curl` - HTTP client
- Shodh Cloudflare worker deployed

**Installing jq:**

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

### Windows (PowerShell)
- PowerShell 5.1+ (included in Windows 10/11)
- No additional dependencies required (uses native `ConvertFrom-Json` and `Invoke-RestMethod`)

## How It Works

1. Claude Code triggers the `Stop` hook after each response
2. Hook reads the transcript file path from stdin
3. Extracts the last user message and assistant response
4. Formats and sends to Shodh Cloudflare `/api/remember` endpoint
5. Memory is stored with type `Conversation` and project tags

## Filtering

The hook includes built-in filtering:
- Skips conversations shorter than 50 characters (noise)
- Truncates content longer than 4000 characters
- Gracefully handles missing transcripts or API errors

## Troubleshooting

**Hook not running:**
- Verify settings.json syntax is valid JSON
- Check hook file has execute permissions (Linux/macOS)
- Restart Claude Code after configuration changes
- Windows: Ensure PowerShell execution policy allows scripts

**Memories not appearing:**
- Test API connectivity: `curl $SHODH_CLOUDFLARE_URL/api/stats`
- Verify API key is correct
- Check environment variables are set

### Debug Mode

**Linux/macOS:**
```bash
export SHODH_DEBUG=1
tail -f /tmp/shodh-hook.log
```

**Windows (PowerShell):**
```powershell
$env:SHODH_DEBUG = "1"
Get-Content "$env:TEMP\shodh-hook.log" -Wait
```

**Example log output:**
```
[14:30:22] SKIP: Too short (150 < 300)
[14:31:45] MATCH: Decision pattern
[14:31:45] STORING: Decision (523 chars)
[14:31:45] DONE
```

### Manual Test

**Linux/macOS:**
```bash
echo '{"transcript_path": "/path/to/transcript.json", "cwd": "/projects/test"}' | bash ~/.claude/hooks/claude-code-ingest-smart.sh
```

**Windows:**
```powershell
'{"transcript_path": "C:\\path\\to\\transcript.json", "cwd": "C:\\projects\\test"}' | powershell -File "$env:USERPROFILE\.claude\hooks\claude-code-ingest-smart.ps1"
```

## Acknowledgments

Adapted from [shodh-memory hooks](https://github.com/varun29ankuS/shodh-memory/tree/main/hooks) by [@varun29ankuS](https://github.com/varun29ankuS).
