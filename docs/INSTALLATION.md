# SHODH-Cloudflare Installation Guide

Complete step-by-step guide to install and configure SHODH-Cloudflare.

## Before You Begin

**Read this first**: [Prerequisites & Requirements](PREREQUISITES.md)

Make sure you have:
- ✅ Cloudflare account (free tier OK)
- ✅ Node.js 18+ installed
- ✅ Claude Desktop with MCP support
- ✅ 30-45 minutes for first-time setup

## Table of Contents

- [Part 1: Worker Deployment (First Time Only)](#part-1-worker-deployment-first-time-only)
- [Part 2: Client Setup (Every Device)](#part-2-client-setup-every-device)
- [Part 3: Verification](#part-3-verification)
- [Part 4: Next Steps](#part-4-next-steps)

---

## Part 1: Worker Deployment (First Time Only)

**Skip this section if:**
- You already deployed the Worker
- You're setting up an additional device
- You're using someone else's Worker

**Follow this section if:**
- This is your first time setting up SHODH-Cloudflare
- You want to deploy your own Worker

---

### Step 1: Clone the Repository

```bash
# Choose a location for the project
cd ~  # or wherever you want to install

# Clone the repository
git clone https://github.com/YOUR_USER/shodh-cloudflare.git
cd shodh-cloudflare
```

**Alternative (without Git)**:
- Download ZIP from GitHub
- Extract to your desired location
- `cd` into the extracted folder

**Verification**:
```bash
ls
# You should see: mcp-bridge/, worker/, scripts/, schema.sql, README.md, etc.
```

---

### Step 2: Install Wrangler CLI

Wrangler is Cloudflare's command-line tool for managing Workers.

```bash
npm install -g wrangler
```

**Verify installation**:
```bash
wrangler --version
```

Expected output: `3.x.x` or higher

**Troubleshooting**:
- **Permission denied**: See [TROUBLESHOOTING.md#npm-permission-errors](TROUBLESHOOTING.md#npm-permission-errors)
- **Command not found**: Ensure `npm`'s global bin is in your PATH

---

### Step 3: Authenticate with Cloudflare

```bash
wrangler login
```

This will:
1. Open your web browser
2. Prompt you to log in to Cloudflare
3. Ask you to authorize Wrangler
4. Display "Successfully logged in"

**Verify authentication**:
```bash
wrangler whoami
```

Expected: Your Cloudflare account email and Account ID

**Troubleshooting**:
- **Browser doesn't open**: Copy the URL from terminal and open manually
- **Already logged in elsewhere**: Run `wrangler logout` first, then `wrangler login` again

---

### Step 4: Create D1 Database

D1 is Cloudflare's distributed SQLite database.

```bash
wrangler d1 create shodh-memory
```

**Expected output**:
```
✅ Successfully created DB 'shodh-memory'!

[[d1_databases]]
binding = "DB"
database_name = "shodh-memory"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**IMPORTANT**: Copy the `database_id` value - you'll need it in Step 6.

**Verify creation**:
```bash
wrangler d1 list
```

You should see `shodh-memory` in the list.

**Troubleshooting**:
- **Database already exists**: Use existing database or delete with `wrangler d1 delete shodh-memory`
- **Limit reached (free tier)**: You can have up to 5 databases. Delete unused ones with `wrangler d1 list` then `wrangler d1 delete <name>`

---

### Step 5: Create Vectorize Index

Vectorize is Cloudflare's vector database for semantic search.

```bash
wrangler vectorize create shodh-vectors --dimensions=384 --metric=cosine
```

**Expected output**:
```
✅ Successfully created index 'shodh-vectors'
```

**IMPORTANT**:
- Dimensions MUST be `384` (for bge-small-en-v1.5 embedding model)
- Metric should be `cosine`

**Verify creation**:
```bash
wrangler vectorize list
```

You should see:
```
shodh-vectors (dimensions: 384, metric: cosine)
```

**Troubleshooting**:
- **Wrong dimensions**: Delete and recreate:
  ```bash
  wrangler vectorize delete shodh-vectors
  wrangler vectorize create shodh-vectors --dimensions=384 --metric=cosine
  ```

---

### Step 6: Configure wrangler.toml

Create configuration file from the template:

```bash
cp worker/wrangler.toml.example worker/wrangler.toml
```

Now edit `worker/wrangler.toml` with your text editor:

**Before (template)**:
```toml
[[d1_databases]]
binding = "DB"
database_name = "shodh-memory"
database_id = "YOUR_D1_DATABASE_ID"  # ← Change this
```

**After (with your database ID from Step 4)**:
```toml
[[d1_databases]]
binding = "DB"
database_name = "shodh-memory"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← Your actual ID
```

**Verify configuration**:
```bash
cat worker/wrangler.toml | grep database_id
```

Should show your actual database ID, not "YOUR_D1_DATABASE_ID"

**Troubleshooting**:
- **Can't find database ID**: Run `wrangler d1 list` to see it again
- **Syntax error**: Make sure to keep the quotes around the ID

---

### Step 7: Initialize Database Schema

Create the tables and indexes in your D1 database:

```bash
cd worker
wrangler d1 execute shodh-memory --file=../schema.sql --remote
```

**Expected output**:
```
🌀 Executing on shodh-memory (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx):
🚣 Executed X commands in Yms
```

**Verify schema**:
```bash
wrangler d1 execute shodh-memory --command="SELECT name FROM sqlite_master WHERE type='table';" --remote
```

**Expected output**:
```
┌───────────────┐
│ name          │
├───────────────┤
│ memories      │
│ memory_edges  │
└───────────────┘
```

**Troubleshooting**:
- **File not found**: Make sure you're in the `worker/` directory
- **Database not found**: Verify `database_id` in `wrangler.toml`
- **SQL errors**: The schema file might be corrupted - try re-cloning the repo

---

### Step 8: Set API Key Secret

Generate a secure API key and set it as a Worker secret:

**Option 1: Generate random API key (recommended)**

```bash
# macOS/Linux - generate random 32-character key
openssl rand -hex 32

# Copy the output, then:
wrangler secret put API_KEY
# Paste the generated key when prompted
```

**Option 2: Use your own API key**

```bash
wrangler secret put API_KEY
# Type your desired API key when prompted (min 20 characters recommended)
```

**Expected output**:
```
✅ Successfully created secret for API_KEY
```

**IMPORTANT**: Save this API key somewhere secure - you'll need it for client setup!

**Verify secret is set**:
```bash
wrangler secret list
```

You should see:
```
API_KEY | ******** (Encrypted)
```

**Troubleshooting**:
- **Secret not showing**: Wait a few seconds and run `wrangler secret list` again
- **Need to update**: Run `wrangler secret put API_KEY` again with a new value

---

### Step 9: Deploy Worker

Install dependencies and deploy:

```bash
# Still in worker/ directory
npm install
npm run deploy
```

**Expected output**:
```
⛅️ wrangler 3.x.x
Your worker has been deployed to:
  https://shodh-api.YOUR_SUBDOMAIN.workers.dev
```

**IMPORTANT**: Save this Worker URL - you'll need it for client setup!

**Verify deployment**:
```bash
# Test health endpoint (replace with your actual URL)
curl https://shodh-api.YOUR_SUBDOMAIN.workers.dev/
```

**Expected response**:
```json
{"message":"SHODH Memory API is running"}
```

**Troubleshooting**:
- **Deployment failed**: See [TROUBLESHOOTING.md#deployment-failed](TROUBLESHOOTING.md#deployment-failed)
- **TypeScript errors**: Make sure you ran `npm install` first
- **URL not working**: Wait 30 seconds for propagation, then try again

---

### Step 10: Test Worker with API Key

Test authentication:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://shodh-api.YOUR_SUBDOMAIN.workers.dev/api/stats
```

**Expected response**:
```json
{
  "total_memories": 0,
  "total_tags": 0,
  "total_edges": 0,
  "oldest_memory": null,
  "newest_memory": null
}
```

**If you get an error**:
- **401 Unauthorized**: API key is wrong or not set (go back to Step 8)
- **404 Not Found**: Check the URL
- **500 Internal Error**: Check Worker logs: `npm run tail`

---

### Worker Deployment Complete!

You now have:
- ✅ D1 database created and initialized
- ✅ Vectorize index created
- ✅ Worker deployed to Cloudflare
- ✅ API key configured
- ✅ Worker URL ready to use

**Save these values for client setup**:
- **Worker URL**: `https://shodh-api.YOUR_SUBDOMAIN.workers.dev`
- **API Key**: The key you generated in Step 8

**Next**: Proceed to [Part 2: Client Setup](#part-2-client-setup-every-device)

---

## Part 2: Client Setup (Every Device)

This section is for configuring your client application to connect to your deployed SHODH Cloudflare Worker.

---

### Option A: Claude Desktop Setup

Follow these steps if you are using Claude Desktop with MCP support.

#### Step 1: Install Node.js (if not already installed)
The MCP Bridge requires Node.js 18+.

**Check current version**:
```bash
node --version
```
If you see `v18.x.x` or higher, skip to the next step. Otherwise, please install it from [nodejs.org](https://nodejs.org/).

#### Step 2A: Automated Setup (Recommended)
The easiest way to set up the client is to use the provided script.

```bash
# If you haven't cloned the repository yet:
git clone https://github.com/YOUR_USER/shodh-cloudflare.git
cd shodh-cloudflare

# Run the automated setup script:
./scripts/setup-client.sh
```
The script will guide you through checking prerequisites, installing dependencies, and generating the correct configuration for Claude Desktop.

**After the script completes, restart Claude Desktop** and proceed to [Part 3: Verification](#part-3-verification).

#### Step 2B: Manual Setup (Alternative)
If the script doesn't work, follow these steps:

1.  **Install MCP Bridge Dependencies:**
    ```bash
    cd /path/to/shodh-cloudflare/mcp-bridge
    npm install
    ```
2.  **Edit Claude Desktop Config:**
    Open your `claude_desktop_config.json` (see [Prerequisites](PREREQUISITES.md) for location) and add the `shodh-cloudflare` server to the `mcpServers` object.
    ```json
    {
      "mcpServers": {
        "shodh-cloudflare": {
          "command": "node",
          "args": [
            "/FULL/PATH/TO/shodh-cloudflare/mcp-bridge/index.js"
          ],
          "env": {
            "SHODH_CLOUDFLARE_URL": "https://your-worker.your-subdomain.workers.dev",
            "SHODH_CLOUDFLARE_API_KEY": "your-api-key-here"
          }
        }
      }
    }
    ```
    **Important:** Replace the placeholders with your **absolute path**, **Worker URL**, and **API Key**.

3.  **Restart Claude Desktop:** You must fully quit and restart the application for changes to take effect.

---

### Option B: Gemini Client Setup (General)

Follow these principles if you are using a Gemini-based client. The exact steps will vary depending on your client's features.

#### Step 1: Install Node.js (if not already installed)
The MCP Bridge, which makes tools available to your client, requires Node.js 18+. Check your version with `node --version`.

#### Step 2: Configure Your Client

You need to configure three main things:

1.  **System Prompt:** Configure your client to use the contents of `skills/shodh-cloudflare/SKILL_GEMINI.md` as its system prompt. This teaches the model about the available tools.

2.  **MCP Bridge (for tools):** If your client supports MCP, configure it to connect to the bridge. This involves adding a server definition similar to the Claude example, pointing to the `mcp-bridge/index.js` script. This will allow the model to automatically call the `remember`, `recall`, etc., tools.

3.  **Post-Response Hook (for auto-memory):** To enable automatic, intelligent memory, configure your client to execute the `hooks/gemini-code-ingest-smart.ps1` script after each response.
    *   **Command:** `pwsh` or `powershell`
    *   **Arguments:** The script requires the path to the conversation transcript JSON file as an argument (e.g., `C:\path\to\hooks\gemini-code-ingest-smart.ps1 {transcript_path}`).

Refer to your specific client's documentation for instructions on how to set the system prompt and configure hooks.

---

## Part 3: Verification

Let's make sure everything works correctly for your client.

### For Claude Desktop

#### Automated Verification (Recommended)
The `verify-installation.sh` script is tailored for the Claude Desktop setup.
```bash
cd /path/to/shodh-cloudflare
./scripts/verify-installation.sh
```
This will test the full stack, from your local config to the remote Worker, and run a test memory cycle. If all checks pass, you're done!

#### Manual Verification
In Claude Desktop, try these commands:
1.  `Can you show me my memory stats?` (should use `shodh-cloudflare:memory_stats`)
2.  `Please remember this: "Testing integration"` (should use `shodh-cloudflare:remember`)
3.  `Recall memories about "testing"` (should use `shodh-cloudflare:recall`)

### For Gemini Clients

Verification for Gemini clients is manual and focuses on ensuring each component is working.

#### Test 1: MCP Bridge Connection
1.  Start the MCP Bridge server manually in your terminal if your client doesn't start it automatically:
    ```bash
    cd /path/to/shodh-cloudflare/mcp-bridge
    # Set environment variables if they aren't globally available
    $env:SHODH_CLOUDFLARE_URL="https://..."
    $env:SHODH_CLOUDFLARE_API_KEY="your-key"
    node index.js
    ```
2.  In your Gemini client, ask a question that should trigger a tool, like: `Using my tools, show me my memory stats`.
3.  Check the terminal where `mcp-bridge` is running. You should see log output indicating a tool call was received and processed.

#### Test 2: Hook Script
1.  Enable debug mode for the hook by setting the environment variable: `$env:SHODH_DEBUG = "1"`.
2.  In your Gemini client, have a conversation that should be remembered. Include the `#remember` tag to be sure.
    *User: `#remember My favorite color is blue.`*
    *Model: `Okay, I will remember that.`*
3.  Check the hook's log file (`$env:TEMP\shodh-gemini-hook.log` on Windows). You should see log entries indicating the script ran, matched a pattern, and stored the memory.
4.  Use your client to `recall memories about my favorite color` to confirm it was saved successfully.

---

## Part 4: Next Steps

Congratulations! SHODH-Cloudflare is now installed and working.

### Learn More

- **Multi-Device Setup**: [MULTI_DEVICE.md](MULTI_DEVICE.md) - Add more devices
- **FAQ**: [FAQ.md](FAQ.md) - Common questions
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Fix issues

### Using SHODH-Cloudflare

You don't need to do anything special - just use Claude Desktop normally!

SHODH-Cloudflare provides these MCP tools:
- `remember` - Store new memories
- `recall` - Search for relevant memories
- `proactive_context` - Get contextual memories
- `list_memories` - List all stored memories
- `forget` - Delete a specific memory
- `forget_by_tags` - Delete memories by tags
- `memory_stats` - View statistics
- `context_summary` - Get memory summary

Claude will automatically use these tools when appropriate.

### Managing Your Memories

**View all memories**:
```
Show me all my memories
```

**Search for specific memories**:
```
What do I remember about [topic]?
```

**Get statistics**:
```
How many memories do I have?
```

**Delete memories**:
```
Forget everything about [topic]
```

### Maintenance

**Update Worker**:
```bash
cd /path/to/shodh-cloudflare
git pull
cd worker
npm install
npm run deploy
```

**Check Worker logs**:
```bash
cd worker
npm run tail
```

**Backup memories** (export D1 database):
```bash
wrangler d1 export shodh-memory --output backup.sql
```

**Restore memories**:
```bash
wrangler d1 execute shodh-memory --file backup.sql --remote
```

---

## Quick Reference

### Worker Management Commands

```bash
# Deploy Worker
cd worker && npm run deploy

# View logs
npm run tail

# Local development
npm run dev

# List deployments
wrangler deployments list
```

### Database Commands

```bash
# List databases
wrangler d1 list

# Query database
wrangler d1 execute shodh-memory --command="SELECT COUNT(*) FROM memories;" --remote

# Export backup
wrangler d1 export shodh-memory --output backup.sql
```

### Secrets Management

```bash
# List secrets
wrangler secret list

# Update API key
wrangler secret put API_KEY

# Delete secret
wrangler secret delete API_KEY
```

### Config File Paths

```bash
# macOS
~/Library/Application Support/Claude/claude_desktop_config.json

# Linux
~/.config/Claude/claude_desktop_config.json

# Windows
%APPDATA%\Claude\claude_desktop_config.json
```

---

## Need Help?

- **Installation issues**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Common questions**: [FAQ.md](FAQ.md)
- **Add more devices**: [MULTI_DEVICE.md](MULTI_DEVICE.md)
- **Report bugs**: [GitHub Issues](https://github.com/YOUR_USER/shodh-cloudflare/issues)

---

**Installed successfully?** Give us a ⭐ on [GitHub](https://github.com/YOUR_USER/shodh-cloudflare)!
