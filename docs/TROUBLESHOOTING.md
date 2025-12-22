# Troubleshooting Guide

This guide helps you diagnose and fix common issues with SHODH-Cloudflare installation and operation.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Worker Deployment Issues](#worker-deployment-issues)
- [Client Setup Issues](#client-setup-issues)
- [Runtime Errors](#runtime-errors)
- [Verification & Testing](#verification--testing)
- [Getting More Help](#getting-more-help)

---

## Installation Issues

### Node.js Version Errors

#### Symptom
```
Error: The engine "node" is incompatible with this module
```

#### Cause
You're running Node.js version < 18.0.0

#### Solution
```bash
# Check your current version
node --version

# If < 18.0.0, upgrade:
# macOS (Homebrew)
brew install node@20

# Linux (nvm)
nvm install 20
nvm use 20

# Windows: Download from nodejs.org
```

#### Verify
```bash
node --version
# Should show v18.x.x or higher
```

---

### npm Permission Errors

#### Symptom
```
Error: EACCES: permission denied
npm ERR! code EACCES
```

#### Cause
npm doesn't have write permissions for global packages or directories

#### Solution (macOS/Linux)
```bash
# Option 1: Fix npm permissions (recommended)
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Option 2: Use sudo (not recommended for security)
sudo npm install -g wrangler
```

#### Solution (Windows)
Run terminal as Administrator, or use:
```bash
npm install -g wrangler --force
```

---

### Claude Desktop Config File Not Found

#### Symptom
```
Error: Could not find Claude Desktop config file
```

#### Cause
Config file doesn't exist yet, or you're looking in the wrong location

#### Solution

Check the correct path for your OS:

**macOS**:
```bash
ls -la ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Linux**:
```bash
ls -la ~/.config/Claude/claude_desktop_config.json
```

**Windows (PowerShell)**:
```powershell
Get-Item $env:APPDATA\Claude\claude_desktop_config.json
```

#### If file doesn't exist:

1. Open Claude Desktop at least once
2. Go to Settings → ensure MCP servers section exists
3. Create the file manually:

**macOS/Linux**:
```bash
mkdir -p ~/Library/Application\ Support/Claude
echo '{"mcpServers":{}}' > ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows (PowerShell)**:
```powershell
New-Item -Path "$env:APPDATA\Claude" -ItemType Directory -Force
Set-Content -Path "$env:APPDATA\Claude\claude_desktop_config.json" -Value '{"mcpServers":{}}'
```

---

## Worker Deployment Issues

### Wrangler Not Authenticated

#### Symptom
```
Error: Not logged in. Please run `wrangler login`
```

#### Solution
```bash
wrangler login
```

This will:
1. Open a browser window
2. Ask you to log in to Cloudflare
3. Grant Wrangler access to your account

#### Verify
```bash
wrangler whoami
```

Should show your Cloudflare account email.

---

### D1 Database Creation Failed

#### Symptom
```
Error creating D1 database
```

#### Possible Causes & Solutions

**1. Already at database limit (Free tier: 5 databases)**

Check existing databases:
```bash
wrangler d1 list
```

Solution: Delete unused databases:
```bash
wrangler d1 delete <database-name>
```

**2. Invalid database name**

Database names must:
- Be lowercase
- Contain only letters, numbers, hyphens, underscores
- Not start with a number

```bash
# Good examples:
wrangler d1 create shodh-memory
wrangler d1 create my_memories

# Bad examples:
wrangler d1 create SHODH  # uppercase not allowed
wrangler d1 create 123-db  # starts with number
```

**3. Network/API error**

Retry with:
```bash
wrangler d1 create shodh-memory --local false
```

---

### Vectorize Index Creation Failed

#### Symptom
```
Error: Failed to create vectorize index
```

#### Solution

**1. Verify dimensions are correct:**
```bash
# MUST be 384 for bge-small-en-v1.5 model
wrangler vectorize create shodh-vectors --dimensions=384 --metric=cosine
```

**2. Check if index already exists:**
```bash
wrangler vectorize list
```

**3. Delete and recreate if needed:**
```bash
wrangler vectorize delete shodh-vectors
wrangler vectorize create shodh-vectors --dimensions=384 --metric=cosine
```

---

### Schema Initialization Failed

#### Symptom
```
Error executing SQL schema
```

#### Solution

**1. Verify D1 database exists:**
```bash
wrangler d1 list
```

**2. Check database ID in wrangler.toml matches:**
```bash
cat worker/wrangler.toml | grep database_id
```

**3. Re-run schema initialization:**
```bash
cd worker
wrangler d1 execute shodh-memory --file=../schema.sql --remote
```

**4. Verify schema was created:**
```bash
wrangler d1 execute shodh-memory --command="SELECT name FROM sqlite_master WHERE type='table';" --remote
```

Expected output should include `memories` and `memory_edges` tables.

---

### API Key Secret Not Set

#### Symptom
```
Error: API authentication failed (401)
```

#### Cause
API_KEY secret not set in Worker, or mismatch between Worker and client

#### Solution

**1. List existing secrets:**
```bash
cd worker
wrangler secret list
```

**2. Set or update API_KEY:**
```bash
wrangler secret put API_KEY
# Enter your API key when prompted (same key used in client setup)
```

**3. Verify secret is set:**
```bash
wrangler secret list
# Should show: API_KEY (Encrypted)
```

**4. Redeploy Worker:**
```bash
npm run deploy
```

---

### Deployment Failed

#### Symptom
```
Error: Deploy failed
```

#### Common Causes & Solutions

**1. wrangler.toml not configured:**
```bash
# Copy example and edit:
cp worker/wrangler.toml.example worker/wrangler.toml

# Edit worker/wrangler.toml and fill in:
# - database_id (from wrangler d1 list)
# - Ensure bindings are correct
```

**2. Missing bindings:**
```bash
# Verify your wrangler.toml has all three bindings:
cat worker/wrangler.toml | grep -A 2 "d1_databases\|vectorize\|ai"
```

**3. TypeScript compilation errors:**
```bash
cd worker
npm install
npm run deploy
```

---

## Client Setup Issues

### Environment Variables Not Set in MCP Bridge

#### Symptom
The MCP bridge process fails to start, with an error in the client's logs like:
```
Error: SHODH_CLOUDFLARE_URL not set
```

#### Cause
The client configuration that launches the `mcp-bridge/index.js` script is missing the `env` section or the variables within it.

#### Solution

1.  **Check your client's configuration** for the MCP server.
2.  **Verify the config** has the `env` section with both `SHODH_CLOUDFLARE_URL` and `SHODH_CLOUDFLARE_API_KEY`.

    **Example `mcpServers` entry (for any client):**
    ```json
    "shodh-cloudflare": {
      "command": "node",
      "args": ["/path/to/shodh-cloudflare/mcp-bridge/index.js"],
      "env": {
        "SHODH_CLOUDFLARE_URL": "https://your-worker.your-subdomain.workers.dev",
        "SHODH_CLOUDFLARE_API_KEY": "your-api-key-here"
      }
    }
    ```

3.  **Common mistakes to check:**
    - Missing the entire `env` block.
    - Typo in variable names (e.g., `SHODH_URL` instead of `SHODH_CLOUDFLARE_URL`).
    - The URL should NOT have a trailing slash (`/`).
    - Incorrect or relative path to `index.js`. It should be an absolute path.

4.  **Restart your client application** after correcting the configuration.

---

### MCP Bridge Issues (Not Starting or Disconnected)

#### Symptom
- Your client shows the MCP server as "disconnected," "failed," or "not running."
- Tools like `remember` or `recall` are not available.

#### Diagnosis

1.  **Check Client Logs:** Look in your AI client's log files for errors related to MCP servers. The location varies per client.
    - For Claude Desktop on macOS, they are in `~/Library/Logs/Claude/mcp*.log`.

2.  **Test the MCP bridge manually:** Run the bridge directly from your terminal to see if it reports any errors on startup.
    ```bash
    # Navigate to the bridge directory
    cd /path/to/shodh-cloudflare/mcp-bridge

    # Set the environment variables manually for the test
    export SHODH_CLOUDFLARE_URL="https://..."
    export SHODH_CLOUDFLARE_API_KEY="your-key"

    # Run the server
    node index.js
    ```
    If this runs without error, the problem is likely in how your client is configured to launch it.

#### Common Causes & Solutions

1.  **Node.js Not Found:**
    The client can't find the `node` executable. Ensure Node.js is installed correctly and that its location is in your system's `PATH`. You can also try using the full, absolute path to the `node` executable in your client's configuration file.

2.  **Dependencies Not Installed:**
    The `mcp-bridge` requires packages like `@modelcontextprotocol/sdk`.
    ```bash
    cd /path/to/shodh-cloudflare/mcp-bridge
    npm install
    ```

3.  **Invalid JSON in Client Config:**
    A syntax error (like a missing comma or quote) in your client's JSON configuration can prevent it from loading the MCP server definition. Use a JSON validator to check your file.

4.  **Path Contains Spaces:**
    If the absolute path to the `mcp-bridge/index.js` script contains spaces, ensure it is correctly quoted within the configuration file.

---

### Hook Script Not Running

#### Symptom
Conversations are not being saved to memory automatically, even when using `#remember`.

#### Diagnosis
1. **Enable Debug Mode:** Set the environment variable `SHODH_DEBUG=1` for your client's process.
2. **Check Log File:** After a conversation, check the hook's log file for activity.
    - **Windows (PowerShell):** `$env:TEMP\shodh-gemini-hook.log`
    - **Linux/macOS (Bash):** `/tmp/shodh-hook.log`
3. If the log file is empty or doesn't exist, the client is not executing the script.

#### Common Causes & Solutions
1. **Hook Not Configured in Client:** Ensure your client is configured to run the appropriate script (`claude-code-ingest-smart.sh` or `gemini-code-ingest-smart.ps1`) after a response.
2. **Incorrect Command/Arguments:** Verify the `command` (e.g., `pwsh`, `bash`) and `args` (the path to the script and the transcript argument) are correct in your client's config.
3. **Permissions:** On Linux/macOS, ensure the `.sh` script is executable (`chmod +x /path/to/script.sh`).
4. **Environment Variables:** The hook scripts also rely on `SHODH_CLOUDFLARE_URL` and `SHODH_CLOUDFLARE_API_KEY`. Make sure these are available to the hook's process.

---

## Runtime Errors

### API Authentication Failed (401)

#### Symptom
```
Error: Unauthorized (401)
```
The Worker rejected the request from the MCP bridge or hook script because the API key was invalid.

#### Cause
API key mismatch between the client configuration and the Worker secret.

#### Solution

1.  **Verify the API key in your client configuration.** Check the `env` block of your `mcpServers` configuration that launches the `mcp-bridge`. For the hook scripts, check the environment variable `SHODH_CLOUDFLARE_API_KEY` available to your client's process.

2.  **Verify the API key in the Worker:**
    ```bash
    cd /path/to/shodh-cloudflare/worker
    wrangler secret list
    ```

3.  **If they don't match, update the Worker's secret:**
    ```bash
    wrangler secret put API_KEY
    # Enter the SAME key used in your client configuration
    npm run deploy
    ```

4.  **Restart your client application** to ensure it picks up any changes.

### Database Query Failed (500)

#### Symptom
```
Error: Database query failed (500)
```
The Worker encountered an error when trying to communicate with the D1 database.

#### Diagnosis

1.  **Check Worker logs:**
    ```bash
    cd /path/to/shodh-cloudflare/worker
    npm run tail
    ```

2.  **Try to query D1 directly:**
    ```bash
    wrangler d1 execute shodh-memory \
      --command="SELECT COUNT(*) FROM memories;" \
      --remote
    ```

#### Solutions

1.  **Schema not initialized:** If the direct query fails, the database might be empty.
    ```bash
    wrangler d1 execute shodh-memory --file=../schema.sql --remote
    ```

2.  **Database binding error:** Verify `wrangler.toml` has the correct `database_id` and the binding is present. Redeploy the worker after any changes.

### Vector Embedding Failed

#### Symptom
```
Error: Failed to generate embedding
```

#### Cause
Workers AI binding issue or the embedding model is unavailable.

#### Solution

1.  **Verify AI binding in `wrangler.toml`:**
    ```toml
    [ai]
    binding = "AI"
    ```

2.  **Check the Cloudflare Status Page** for any incidents related to Workers AI.

3.  **Redeploy the Worker:**
    ```bash
    cd /path/to/shodh-cloudflare/worker
    npm run deploy
    ```

---

## Verification & Testing

### How to Test Worker Health

```bash
curl https://your-worker.your-subdomain.workers.dev/

# Expected response:
{"message":"SHODH Memory API is running"}
```

### How to Test API Authentication

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://your-worker.your-subdomain.workers.dev/api/stats

# Expected response:
{"total_memories": 0, "total_tags": 0, ...}
```

### How to Test D1 Database

```bash
wrangler d1 execute shodh-memory \
  --command="SELECT name FROM sqlite_master WHERE type='table';" \
  --remote

# Expected: memories, memory_edges
```

### How to Test MCP Tools

In your configured AI client, try to trigger a tool call.

1.  Ask the AI: `Can you store this memory using your tools: "This is a test memory"`
2.  The AI should use the `remember` tool.
3.  Check the console output of the `mcp-bridge` server to see the tool call being processed.
4.  Then ask: `Can you recall memories about "test"?`
5.  The `recall` tool should be used, and it should return your test memory.

### How to Run Automated Verification (Claude Desktop)

The verification script is tailored for the Claude Desktop automated setup.
```bash
cd /path/to/shodh-cloudflare
./scripts/verify-installation.sh
```
This will run all checks automatically and report issues. For other clients, manual verification is required.

---

## Common Error Messages

### `MODULE_NOT_FOUND`

**Cause**: npm dependencies for the `mcp-bridge` have not been installed.

**Solution**:
```bash
cd /path/to/shodh-cloudflare/mcp-bridge
npm install
```

### `ECONNREFUSED`

**Cause**: The Worker URL in your client configuration is wrong, or the Worker is not deployed.

**Solution**:
1.  Verify the `SHODH_CLOUDFLARE_URL` in your client's MCP configuration.
2.  Redeploy the Worker: `cd worker && npm run deploy`

### `Invalid JSON`

**Cause**: A syntax error exists in your client's JSON configuration file.

**Solution**:
- Use a JSON validator or your code editor's linter to find and fix the error (e.g., a missing comma, trailing comma, or unclosed quote).

---

## Advanced Debugging

### Enable Verbose Logging

**MCP Bridge:**

Edit `mcp-bridge/index.js` and add `console.error` statements to trace variable values and execution flow.

**Worker:**

Check live logs from your deployed worker:
```bash
cd /path/to/shodh-cloudflare/worker
npm run tail
```

### Inspect Client MCP Logs

The location of logs related to the MCP server process depends on the client application.
- **For Claude Desktop on macOS:**
  ```bash
  tail -100 ~/Library/Logs/Claude/mcp-server-shodh-cloudflare.log
  ```
- For other clients, check their documentation or log directories for output from background processes.

### Test Worker Locally

You can run a local instance of your worker for easier debugging.
```bash
cd /path/to/shodh-cloudflare/worker
npm run dev
```
The worker will then be available at `http://localhost:8787`. You can point your client configuration to this local URL for testing.

---

## Getting More Help

### Before Reporting Issues

1.  If using Claude, run the verification script: `./scripts/verify-installation.sh`
2.  Check Worker logs: `cd worker && npm run tail`
3.  Check your client's logs for errors related to MCP or hooks.
4.  Test the Worker URL directly with `curl`.
5.  Verify all prerequisites from [PREREQUISITES.md](PREREQUISITES.md).

### Report a Bug

If you've tried the above and still have issues, please open a [GitHub Issue](https://github.com/YOUR_USER/shodh-cloudflare/issues) with detailed information.

---

## Quick Reference

### Health Check Commands

```bash
# Node.js version
node --version  # Should be >= 18.0.0

# Worker health
curl https://YOUR_WORKER_URL/

# Worker auth test
curl -H "Authorization: Bearer YOUR_API_KEY" https://YOUR_WORKER_URL/api/stats

# D1 database
wrangler d1 list

# Vectorize index
wrangler vectorize list

# Wrangler auth status
wrangler whoami

# MCP bridge test
cd mcp-bridge && node index.js
```

