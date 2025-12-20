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

### Environment Variables Not Set

#### Symptom
In Claude Desktop, MCP server shows error:
```
Error: SHODH_CLOUDFLARE_URL not set
```

#### Solution

**1. Check your Claude Desktop config:**

**macOS/Linux**:
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq '.mcpServers."shodh-cloudflare"'
```

**2. Verify the config has env variables:**
```json
{
  "mcpServers": {
    "shodh-cloudflare": {
      "command": "node",
      "args": ["/path/to/shodh-cloudflare/mcp-bridge/index.js"],
      "env": {
        "SHODH_CLOUDFLARE_URL": "https://your-worker.your-subdomain.workers.dev",
        "SHODH_CLOUDFLARE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**3. Common mistakes:**
- Missing `env` section
- Typo in environment variable names
- Missing trailing slash in URL (should NOT have trailing slash)
- Wrong path to index.js

#### Fix
Run the setup script again:
```bash
cd /path/to/shodh-cloudflare
./scripts/setup-client.sh
```

Or edit the config file manually and restart Claude Desktop.

---

### MCP Bridge Not Starting

#### Symptom
Claude Desktop shows MCP server as "disconnected" or "failed"

#### Diagnosis

**1. Check Claude Desktop logs:**

**macOS**:
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Linux**:
```bash
journalctl --user -u claude-desktop -f
```

**Windows**:
Check Event Viewer or Claude Desktop's log directory

**2. Test MCP bridge manually:**
```bash
cd /path/to/shodh-cloudflare/mcp-bridge
node index.js
```

Look for errors in the output.

#### Common Causes & Solutions

**1. Node.js not found:**
```bash
# Verify Node.js is in PATH:
which node
node --version

# If not found, add to PATH or use full path in config:
"command": "/usr/local/bin/node"
```

**2. Dependencies not installed:**
```bash
cd /path/to/shodh-cloudflare/mcp-bridge
npm install
```

**3. Invalid JSON in config:**
Validate your config file:
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq '.'
```

If `jq` shows errors, fix the JSON syntax.

**4. Path with spaces not quoted:**
If your path contains spaces, ensure it's properly quoted in the config:
```json
"args": ["/Users/name/My Folder/shodh-cloudflare/mcp-bridge/index.js"]
```

---

### Worker URL Not Reachable

#### Symptom
```
Error: ENOTFOUND or Connection timeout
```

#### Diagnosis

**1. Test Worker URL directly:**
```bash
curl https://your-worker.your-subdomain.workers.dev/
```

Expected: `{"message":"SHODH Memory API is running"}`

**2. Test with API key:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://your-worker.your-subdomain.workers.dev/api/stats
```

#### Solutions

**1. Worker not deployed:**
```bash
cd worker
npm run deploy
```

**2. Wrong URL:**
Get correct URL:
```bash
wrangler deployments list
```

**3. Firewall blocking:**
- Check corporate firewall rules
- Try from different network
- Verify `*.workers.dev` is allowed

**4. DNS issues:**
```bash
# Test DNS resolution:
nslookup your-worker.your-subdomain.workers.dev
```

---

## Runtime Errors

### API Authentication Failed (401)

#### Symptom
```
Error: Unauthorized (401)
```

#### Cause
API key mismatch between client and Worker

#### Solution

**1. Verify API key in client config:**
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | \
  jq '.mcpServers."shodh-cloudflare".env.SHODH_CLOUDFLARE_API_KEY'
```

**2. Verify API key in Worker:**
```bash
cd worker
wrangler secret list
```

**3. Update Worker API key:**
```bash
wrangler secret put API_KEY
# Enter the SAME key used in client config
npm run deploy
```

**4. Restart Claude Desktop**

---

### Database Query Failed (500)

#### Symptom
```
Error: Database query failed (500)
```

#### Diagnosis

**1. Check Worker logs:**
```bash
cd worker
npm run tail
```

**2. Try to query D1 directly:**
```bash
wrangler d1 execute shodh-memory \
  --command="SELECT COUNT(*) FROM memories;" \
  --remote
```

#### Solutions

**1. Schema not initialized:**
```bash
wrangler d1 execute shodh-memory --file=../schema.sql --remote
```

**2. Database binding error:**
Verify `wrangler.toml` has correct `database_id`:
```bash
wrangler d1 list
# Copy the ID for shodh-memory
# Update worker/wrangler.toml
npm run deploy
```

---

### Vector Embedding Failed

#### Symptom
```
Error: Failed to generate embedding
```

#### Cause
Workers AI binding issue or model unavailable

#### Solution

**1. Verify AI binding in wrangler.toml:**
```toml
[ai]
binding = "AI"
```

**2. Test Workers AI:**
```bash
cd worker
wrangler dev
# Then test embedding endpoint
```

**3. Check Workers AI status:**
- Visit [Cloudflare Status Page](https://www.cloudflarestatus.com/)
- Look for Workers AI incidents

**4. Redeploy Worker:**
```bash
npm run deploy
```

---

### Memory Not Found (404)

#### Symptom
```
Error: Memory not found (404)
```

#### Cause
Memory doesn't exist, or ID is incorrect

#### Diagnosis

**1. List all memories:**
Use Claude Desktop to run:
```
Can you show me all my memories using shodh-cloudflare:list_memories?
```

**2. Check memory count:**
```
What are my memory stats?
```

#### Solution

If memories are missing unexpectedly:

**1. Check D1 database:**
```bash
wrangler d1 execute shodh-memory \
  --command="SELECT COUNT(*) FROM memories;" \
  --remote
```

**2. Inspect specific memory:**
```bash
wrangler d1 execute shodh-memory \
  --command="SELECT * FROM memories WHERE id = 'MEMORY_ID';" \
  --remote
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

### How to Test Vectorize Index

```bash
wrangler vectorize list

# Should show:
# shodh-vectors (dimensions: 384, metric: cosine)
```

### How to Test MCP Tools in Claude

In Claude Desktop, try:

```
Can you store this memory using shodh-cloudflare:remember?
"This is a test memory"
```

Then retrieve it:
```
Can you recall memories about "test" using shodh-cloudflare:recall?
```

### How to Run Automated Verification

```bash
cd /path/to/shodh-cloudflare
./scripts/verify-installation.sh
```

This will run all checks automatically and report issues.

---

## Common Error Messages

### `MODULE_NOT_FOUND`

**Cause**: npm dependencies not installed

**Solution**:
```bash
cd mcp-bridge
npm install
```

### `ECONNREFUSED`

**Cause**: Worker URL is wrong or Worker is not deployed

**Solution**:
1. Verify Worker URL
2. Redeploy Worker: `cd worker && npm run deploy`

### `Invalid JSON`

**Cause**: Malformed `claude_desktop_config.json`

**Solution**:
```bash
# Validate JSON:
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq '.'

# Fix syntax errors (missing commas, quotes, brackets)
```

### `CORS Error`

**Cause**: Cross-Origin request blocked (shouldn't happen with MCP)

**Solution**:
- This typically indicates the client is trying to access the Worker from a browser
- MCP should use Node.js fetch, not browser fetch
- Ensure you're using the Worker URL in the MCP config, not trying to access it from a web browser

---

## Advanced Debugging

### Enable Verbose Logging

**MCP Bridge:**

Edit `mcp-bridge/index.js` and add debug logging:
```javascript
console.error("Debug: API_URL=", process.env.SHODH_CLOUDFLARE_URL);
console.error("Debug: API_KEY=", process.env.SHODH_CLOUDFLARE_API_KEY ? "SET" : "NOT SET");
```

**Worker:**

Check live logs:
```bash
cd worker
npm run tail
```

### Inspect Claude Desktop MCP Logs

**macOS**:
```bash
tail -100 ~/Library/Logs/Claude/mcp-server-shodh-cloudflare.log
```

**Linux**:
```bash
tail -100 ~/.config/Claude/logs/mcp-server-shodh-cloudflare.log
```

### Test Worker Locally

```bash
cd worker
npm run dev

# In another terminal:
curl http://localhost:8787/
```

### Inspect D1 Database Contents

```bash
# Count memories:
wrangler d1 execute shodh-memory \
  --command="SELECT COUNT(*) FROM memories;" \
  --remote

# View recent memories:
wrangler d1 execute shodh-memory \
  --command="SELECT id, content, created_at FROM memories ORDER BY created_at DESC LIMIT 5;" \
  --remote

# View all tables:
wrangler d1 execute shodh-memory \
  --command="SELECT name FROM sqlite_master WHERE type='table';" \
  --remote
```

---

## Getting More Help

### Before Reporting Issues

1. Run the verification script: `./scripts/verify-installation.sh`
2. Check Worker logs: `cd worker && npm run tail`
3. Check Claude Desktop logs
4. Test Worker URL directly with `curl`
5. Verify all prerequisites: [PREREQUISITES.md](PREREQUISITES.md)

### Report a Bug

If you've tried the above and still have issues:

1. Go to [GitHub Issues](https://github.com/YOUR_USER/shodh-cloudflare/issues)
2. Click "New Issue"
3. Include:
   - Operating system (macOS/Linux/Windows + version)
   - Node.js version (`node --version`)
   - Error messages (full output)
   - Steps to reproduce
   - Worker logs (if applicable)
   - Configuration (remove API keys!)

### Community Resources

- **GitHub Discussions**: For questions and general help
- **FAQ**: [FAQ.md](FAQ.md) - Common questions answered
- **Installation Guide**: [INSTALLATION.md](INSTALLATION.md) - Step-by-step setup
- **Multi-Device Setup**: [MULTI_DEVICE.md](MULTI_DEVICE.md) - Adding more devices

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

### Config File Paths

```bash
# macOS
~/Library/Application Support/Claude/claude_desktop_config.json

# Linux
~/.config/Claude/claude_desktop_config.json

# Windows
%APPDATA%\Claude\claude_desktop_config.json
```

### Log Locations

```bash
# Claude Desktop logs (macOS)
~/Library/Logs/Claude/

# Worker logs (real-time)
cd worker && npm run tail
```

---

If this guide didn't solve your problem, please check [FAQ.md](FAQ.md) or open a [GitHub Issue](https://github.com/YOUR_USER/shodh-cloudflare/issues).
