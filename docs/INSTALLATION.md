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

This section is for:
- Setting up your first device after Worker deployment
- Adding additional devices (laptop, desktop, etc.)
- Reconnecting after reinstalling Claude Desktop

---

### Step 1: Install Node.js (if not already installed)

**Check current version**:
```bash
node --version
```

If you see `v18.x.x` or higher, skip to Step 2.

**Install Node.js**:

**macOS (Homebrew)**:
```bash
brew install node@20
```

**Linux (nvm)**:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

**Windows**:
- Download from [nodejs.org](https://nodejs.org/)
- Install the LTS version (20.x)

**Verify**:
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

---

### Step 2A: Automated Setup (Recommended)

The easiest way to set up the client:

```bash
# If you haven't cloned the repository yet:
git clone https://github.com/YOUR_USER/shodh-cloudflare.git
cd shodh-cloudflare

# Run the automated setup script:
./scripts/setup-client.sh
```

The script will:
1. ✅ Check prerequisites (Node.js version)
2. ✅ Install MCP bridge dependencies
3. ✅ Ask for your Worker URL
4. ✅ Ask for your API Key
5. ✅ Detect your OS and config file location
6. ✅ Generate the configuration
7. ✅ Show you what to add to Claude Desktop config

**Follow the script's instructions carefully!**

**After the script completes**:
1. Restart Claude Desktop
2. Proceed to [Part 3: Verification](#part-3-verification)

**Troubleshooting**:
- **Script fails**: Try manual setup below (Step 2B)
- **Permission denied**: `chmod +x scripts/setup-client.sh`

---

### Step 2B: Manual Setup (Alternative)

If the automated script doesn't work, follow these manual steps:

#### 2B.1: Install MCP Bridge Dependencies

```bash
cd shodh-cloudflare/mcp-bridge
npm install
```

**Verify**:
```bash
ls node_modules
# Should see @modelcontextprotocol
```

#### 2B.2: Find Claude Desktop Config Location

**macOS**:
```bash
CONFIG_PATH=~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Linux**:
```bash
CONFIG_PATH=~/.config/Claude/claude_desktop_config.json
```

**Windows (PowerShell)**:
```powershell
$CONFIG_PATH = "$env:APPDATA\Claude\claude_desktop_config.json"
```

#### 2B.3: Create or Edit Config File

**If the file doesn't exist, create it**:

```bash
# macOS/Linux
mkdir -p ~/Library/Application\ Support/Claude
echo '{"mcpServers":{}}' > ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Edit the config file** with your text editor:

**Before (empty or existing)**:
```json
{
  "mcpServers": {}
}
```

**After (add shodh-cloudflare entry)**:
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

**IMPORTANT Replacements**:
1. Replace `/FULL/PATH/TO/shodh-cloudflare` with the ABSOLUTE path to your shodh-cloudflare directory
   - Find it with: `pwd` (while in shodh-cloudflare directory)
   - Example macOS: `/Users/yourname/shodh-cloudflare`
   - Example Linux: `/home/yourname/shodh-cloudflare`
   - Example Windows: `C:\\Users\\yourname\\shodh-cloudflare`

2. Replace `https://your-worker.your-subdomain.workers.dev` with YOUR actual Worker URL from Part 1, Step 9

3. Replace `your-api-key-here` with YOUR actual API key from Part 1, Step 8

**Validate JSON syntax**:
```bash
# macOS/Linux
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq '.'

# If jq shows errors, fix the JSON syntax (commas, quotes, brackets)
```

---

### Step 3: Restart Claude Desktop

**macOS**:
```bash
# Quit Claude Desktop completely
killall Claude

# Reopen Claude Desktop from Applications
```

**Linux**:
```bash
# Quit and restart Claude Desktop
# (method depends on your desktop environment)
```

**Windows**:
- Right-click Claude Desktop in system tray
- Select "Quit"
- Reopen from Start Menu

**Wait 10-15 seconds** for Claude Desktop to initialize MCP servers.

---

### Step 4: Verify MCP Server Connection

In Claude Desktop:

1. Look for MCP indicator (usually in bottom-left or settings)
2. Check if `shodh-cloudflare` server is listed
3. Status should be "connected" or "running"

**If disconnected**:
- Check Claude Desktop logs (see [TROUBLESHOOTING.md#mcp-bridge-not-starting](TROUBLESHOOTING.md#mcp-bridge-not-starting))
- Verify config file syntax
- Ensure paths are absolute, not relative
- Restart Claude Desktop again

---

### Client Setup Complete!

Your device is now configured to use SHODH-Cloudflare!

**Next**: [Part 3: Verification](#part-3-verification)

---

## Part 3: Verification

Let's make sure everything works correctly.

### Automated Verification (Recommended)

```bash
cd /path/to/shodh-cloudflare
./scripts/verify-installation.sh
```

This will test:
- ✅ Node.js version
- ✅ npm packages installed
- ✅ Claude Desktop config exists
- ✅ Config has shodh-cloudflare entry
- ✅ Environment variables are set
- ✅ Worker URL is reachable
- ✅ API authentication works
- ✅ Can create/recall/delete test memory

**If all checks pass**: You're done! 🎉

**If any checks fail**: See the error messages for troubleshooting hints, or check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

### Manual Verification

If you prefer to test manually:

#### Test 1: Memory Stats

In Claude Desktop, type:
```
Can you show me my memory stats?
```

Claude should use `shodh-cloudflare:memory_stats` and show:
```json
{
  "total_memories": 0,
  "total_tags": 0,
  ...
}
```

#### Test 2: Store a Memory

```
Please remember this using shodh-cloudflare:remember:
"Testing SHODH-Cloudflare integration"
```

Claude should confirm memory was stored.

#### Test 3: Recall the Memory

```
Can you recall memories about "testing" using shodh-cloudflare:recall?
```

Claude should find and display your test memory.

#### Test 4: List Memories

```
Show me all my memories using shodh-cloudflare:list_memories
```

You should see your test memory in the list.

#### Test 5: Delete Test Memory

```
Delete the test memory using shodh-cloudflare:forget
```

Claude should confirm deletion.

**If any test fails**:
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Check Worker logs: `cd worker && npm run tail`
- Verify API key matches between config and Worker
- Ensure Worker URL is correct

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
