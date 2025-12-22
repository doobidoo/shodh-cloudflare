# Shodh Cloudflare Hooks

Hooks for AI clients to enable automatic conversation ingestion into Shodh Cloudflare.

## Smart Ingestion Logic

The "smart" hooks (`claude-code-ingest-smart.sh` and `gemini-code-ingest-smart.ps1`) share the same intelligent filtering logic to decide which conversations are valuable enough to be stored.

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

## Client Setup

### 1. Claude Client Setup

Use these hooks for clients like Claude Code that use a `~/.claude/settings.json` configuration.

**Available Hooks:**
- `claude-code-ingest-smart.sh`: **(Recommended)** Smart ingest for Linux/macOS.
- `claude-code-ingest-smart.ps1`: **(Recommended)** Smart ingest for Windows.
- `claude-code-ingest.sh`: (Basic) Stores every conversation.

**Installation (Linux/macOS):**
1.  **Copy Script:**
    ```bash
    mkdir -p ~/.claude/hooks
    cp hooks/claude-code-ingest-smart.sh ~/.claude/hooks/
    chmod +x ~/.claude/hooks/claude-code-ingest-smart.sh
    ```
2.  **Configure `~/.claude/settings.json`:**
    ```json
    {
      "hooks": {
        "post_response": {
          "command": "/bin/bash",
          "args": ["~/.claude/hooks/claude-code-ingest-smart.sh"]
        }
      }
    }
    ```

**Installation (Windows/PowerShell):**
1.  **Copy Script:**
    ```powershell
    New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\hooks"
    Copy-Item "hooks\claude-code-ingest-smart.ps1" "$env:USERPROFILE\.claude\hooks\"
    ```
2.  **Configure `%USERPROFILE%\.claude\settings.json`:**
    ```json
    {
      "hooks": {
        "post_response": {
          "command": "pwsh",
          "args": ["%USERPROFILE%\\.claude\\hooks\\claude-code-ingest-smart.ps1"]
        }
      }
    }
    ```

### 2. Gemini Client Setup

Use this hook for Gemini-based clients that can be configured to run a script after generating a response.

**Available Hook:**
- `gemini-code-ingest-smart.ps1`: **(Recommended)** Smart ingest (PowerShell-based).

**Installation:**
The exact installation depends on your Gemini client's configuration. The goal is to have the client execute the `gemini-code-ingest-smart.ps1` script after each response, passing the path to the conversation transcript as an argument.

1.  **Place the script** in a known location on your system.
2.  **Configure your client** to call it.

**Hypothetical Gemini Client Configuration (`settings.json`):**
```json
{
  "hooks": {
    "post_response": {
      "command": "pwsh",
      "args": ["C:\\path\\to\\shodh-cloudflare\\hooks\\gemini-code-ingest-smart.ps1", "{transcript_path}"]
    }
  }
}
```
*This is an illustrative example. The `{transcript_path}` placeholder must be replaced by the variable your specific client provides.*

### 3. Environment Variables (All Clients)

The hooks require the following environment variables to be set.

**Linux/macOS (add to `~/.bashrc`, `~/.zshrc`):**
```bash
# Required
export SHODH_CLOUDFLARE_URL="https://your-worker.your-subdomain.workers.dev"
export SHODH_CLOUDFLARE_API_KEY="your-api-key"

# Optional
export SHODH_MIN_LENGTH=300
export SHODH_DEBUG=1
export SHODH_LOG_FILE=/tmp/shodh-hook.log
```

**Windows (run in PowerShell for persistent user-level variables):**
```powershell
[Environment]::SetEnvironmentVariable("SHODH_CLOUDFLARE_URL", "https://your-worker.workers.dev", "User")
[Environment]::SetEnvironmentVariable("SHODH_CLOUDFLARE_API_KEY", "your-api-key", "User")
[Environment]::SetEnvironmentVariable("SHODH_MIN_LENGTH", "300", "User")
```
**Note:** Restart your client application after setting environment variables.

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

1.  The client application (e.g., Claude Code, Gemini CLI) is configured to trigger a `post_response` hook.
2.  The client executes the appropriate hook script, passing context (like the transcript path) via standard input.
3.  The script reads the last user message and assistant response from the transcript.
4.  It applies smart filtering logic to determine if the conversation is valuable.
5.  If valuable, it formats the data and sends it to the Shodh Cloudflare `/api/remember` endpoint.

## Filtering

The hook includes built-in filtering:
- Skips conversations shorter than a configurable minimum length (default 300 chars).
- Truncates content longer than 4000 characters.
- Gracefully handles missing transcripts or API errors.

## Troubleshooting

**Hook not running:**
- Verify your client's settings file syntax is valid JSON.
- Check that the hook script file has execute permissions (`chmod +x` on Linux/macOS).
- Restart your client application after any configuration changes.
- Ensure your client's hook mechanism is correctly pointing to the script and passing the required arguments.

**Memories not appearing:**
- Test API connectivity: `curl $env:SHODH_CLOUDFLARE_URL/api/stats` (or `curl $SHODH_CLOUDFLARE_URL/api/stats` on bash).
- Verify the `SHODH_CLOUDFLARE_API_KEY` is correct.
- Check that the required environment variables are set and available to the client application's process.

### Debug Mode

Enable debug mode by setting the environment variable `SHODH_DEBUG=1`. The hook will write detailed logs to `$env:TEMP\shodh-hook.log` (Windows) or `/tmp/shodh-hook.log` (Linux/macOS).

**Windows (PowerShell):**
```powershell
$env:SHODH_DEBUG = "1"
Get-Content "$env:TEMP\shodh-gemini-hook.log" -Wait
```

**Linux/macOS (Bash):**
```bash
export SHODH_DEBUG=1
tail -f /tmp/shodh-hook.log
```

**Example log output:**
```
[14:30:22] SKIP: Too short (150 < 300)
[14:31:45] MATCH: Decision pattern
[14:31:45] STORING: Decision (523 chars)
[14:31:45] DONE
```

### Manual Test

You can test the scripts manually by piping a mock JSON input.

**Claude Hook (Bash on Linux/macOS):**
```bash
echo '{"transcript_path": "/path/to/transcript.json", "cwd": "/projects/test"}' | bash hooks/claude-code-ingest-smart.sh
```

**Gemini Hook (PowerShell on Windows):**
*Create a dummy transcript file `C:\temp\gemini_transcript.json` with the content: `[{"role": "user", "content": "#remember this is a test"}, {"role": "model", "content": "OK, I will remember."}]`*
```powershell
# In the shodh-cloudflare directory
pwsh -File hooks/gemini-code-ingest-smart.ps1 -TranscriptPath "C:\temp\gemini_transcript.json"
```

## Acknowledgments

Adapted from [shodh-memory hooks](https://github.com/varun29ankuS/shodh-memory/tree/main/hooks) by [@varun29ankuS](https://github.com/varun29ankuS).
