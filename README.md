# SHODH on Cloudflare

## Your AI's memory shouldn't disappear when you switch devices.

You're on your laptop working with Claude. It remembers your project structure, coding style, and decisions. Then you switch to your phone—and it's all gone. You're re-explaining the same context. **Again.**

**SHODH on Cloudflare solves this.** Your AI's memory syncs globally across all your devices through Cloudflare's edge network. Same context everywhere, always available, <50ms latency worldwide.

> Built with [SHODH Memory](https://github.com/varun29ankuS/shodh-memory) architecture by [@varun29ankuS](https://github.com/varun29ankuS)

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Cloudflare Edge                    │
│  ┌─────────────┐   ┌──────────┐   ┌──────────┐  │
│  │   Worker    │──▶│    D1    │   │Vectorize │  │
│  │  (API)      │   │(metadata)│   │(vectors) │  │
│  └──────┬──────┘   └──────────┘   └──────────┘  │
│         │                                       │
│         ▼                                       │
│  ┌─────────────┐                                │
│  │ Workers AI  │  (bge-small-en-v1.5 embeddings)│
│  └─────────────┘                                │
└─────────────────────────────────────────────────┘
          ▲
          │ HTTPS
          │
    ┌─────┴─────┐
    │  Devices  │  (laptop, phone, tablet...)
    └───────────┘
```

## Why Multi-Device Memory Matters

| Without SHODH | With SHODH |
|---------------|------------|
| ❌ "What's your tech stack again?" | ✅ "I remember you're using Next.js with Prisma" |
| ❌ Context lost when switching devices | ✅ Same context on laptop, phone, tablet |
| ❌ Re-explain project after every restart | ✅ AI already knows your project structure |
| ❌ Memories stuck on one machine | ✅ Global sync, <50ms anywhere |

## How It Works

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Edge API** | Cloudflare Workers | REST API in 300+ cities worldwide |
| **Memory Storage** | D1 (SQLite) | Content, tags, timestamps |
| **Semantic Search** | Vectorize | Find memories by meaning, not keywords |
| **AI Embeddings** | Workers AI | bge-small-en-v1.5 (384 dimensions) |
| **Device Bridge** | Node.js MCP | Works with Claude, Cursor, VS Code

## Documentation

**Before Installing**:
- 📋 [**Prerequisites & Requirements**](docs/PREREQUISITES.md) - What you need before starting
- 📚 [**Installation Guide**](docs/INSTALLATION.md) - Complete step-by-step setup
- ❓ [**FAQ**](docs/FAQ.md) - Frequently asked questions

**If You Need Help**:
- 🔧 [**Troubleshooting**](docs/TROUBLESHOOTING.md) - Common issues and solutions
- 🖥️ [**Multi-Device Setup**](docs/MULTI_DEVICE.md) - Adding additional devices

**Development & Background**:
- 📖 [**Development Journey**](JOURNEY.md) - How we built this
- 📝 [**Changelog**](CHANGELOG.md) - Version history

## Quick Start

> **First-time setup?** You'll deploy the Worker once, then add devices anytime. See [complete guide](docs/INSTALLATION.md).

### Express Setup (2 Minutes)

**Already have a Worker running?** Add this device:

```bash
# Clone and setup
git clone https://github.com/YOUR_USER/shodh-cloudflare.git
cd shodh-cloudflare
./scripts/setup-client.sh
```

The script asks for your Worker URL and API key, then configures Claude Desktop automatically.

**Need to deploy the Worker first?** Quick reference:

```bash
# 1. Create resources
wrangler d1 create shodh-memory
wrangler vectorize create shodh-vectors --dimensions=384 --metric=cosine

# 2. Deploy
cd worker && npm install && npm run deploy

# 3. Set API key
wrangler secret put API_KEY
```

<details>
<summary>📖 <b>Detailed setup guide</b> (first-time deployment, troubleshooting)</summary>

See the [complete installation guide](docs/INSTALLATION.md) for:
- Prerequisites check (Node.js 18+, Cloudflare account)
- Step-by-step Worker deployment with verification
- Multi-device setup instructions
- Troubleshooting common issues

</details>

## Client Configuration

This system can be integrated with any AI client that supports the [Model Context Protocol (MCP)](https://github.com/model-context-protocol/spec) or can have its behavior customized with hooks and system prompts.

### Claude Desktop

Add the following to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "shodh-cloudflare": {
      "command": "node",
      "args": ["/path/to/shodh-cloudflare/mcp-bridge/index.js"],
      "env": {
        "SHODH_CLOUDFLARE_URL": "https://your-worker-name.your-subdomain.workers.dev",
        "SHODH_CLOUDFLARE_API_KEY": "your-api-key"
      }
    }
  },
  "hooks": {
    "post_response": {
        "command": "/bin/bash",
        "args": ["/path/to/shodh-cloudflare/hooks/claude-code-ingest-smart.sh"]
    }
  }
}
```

After editing the config:
1. **Restart Claude Desktop** (important!)
2. The MCP tools will become available, and the `post_response` hook will automatically save valuable conversations to your Shodh memory.

### Gemini CLI (or other clients)

For Gemini or other clients, you will need to:
1.  **Provide the System Prompt:** Configure your client to use the instructions from `skills/shodh-cloudflare/SKILL_GEMINI.md`. This file tells the Gemini model how to use the available tools.
2.  **Implement the MCP Bridge:** If your client supports MCP, configure it to connect to the `mcp-bridge/index.js` server just like the Claude Desktop configuration above.
3.  **Implement the Post-Response Hook:** To enable automatic memory, configure your client to execute the `hooks/gemini-code-ingest-smart.ps1` script after each response. The script requires the path to a JSON file containing the conversation transcript as an argument.

**Example Gemini Client Configuration (hypothetical):**
```json
{
  "system_prompt_path": "/path/to/shodh-cloudflare/skills/SKILL_GEMINI.md",
  "mcp_servers": [
      { "name": "shodh-cloudflare", "command": ["node", "/path/to/shodh-cloudflare/mcp-bridge/index.js"] }
  ],
  "hooks": {
      "post_response": {
          "command": "pwsh",
          "args": ["/path/to/shodh-cloudflare/hooks/gemini-code-ingest-smart.ps1", "{transcript_path}"]
      }
  }
}
```
*This is an illustrative example. Actual implementation depends on your specific Gemini client's configuration capabilities.*

## Verification

After installation, verify everything works:

### Automated Verification (Recommended)

```bash
cd shodh-cloudflare
./scripts/verify-installation.sh
```

This will test:
- ✅ Node.js version and npm
- ✅ MCP bridge dependencies installed
- ✅ Claude Desktop config exists and is valid
- ✅ Worker URL is reachable
- ✅ API authentication works

### Manual Testing

In Claude Desktop, try these commands:

```
1. Show me my memory stats
   (Uses shodh-cloudflare:memory_stats)

2. Remember this: "Test memory for verification"
   (Uses shodh-cloudflare:remember)

3. Recall memories about "test"
   (Uses shodh-cloudflare:recall)
```

If all commands work, you're ready to go! 🎉

**Having issues?** See the [Troubleshooting Guide](docs/TROUBLESHOOTING.md).

## API Endpoints

Compliant with [SHODH Memory API Specification](./specs/README.md) (OpenAPI 3.1).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check (basic) |
| `/api/health` | GET | Health check (detailed) |
| `/api/remember` | POST | Store a memory |
| `/api/recall` | POST | Semantic search (with quality boost) |
| `/api/recall/by-tags` | POST | Tag-based search |
| `/api/context` | POST | Proactive context surfacing |
| `/api/memories` | GET | List all memories |
| `/api/memories/:id` | GET | Get specific memory |
| `/api/memories/:id` | PATCH | Update memory metadata |
| `/api/forget/:id` | DELETE | Delete memory |
| `/api/forget/by-tags` | POST | Delete by tags |
| `/api/tags` | GET | List all tags |
| `/api/stats` | GET | Memory statistics |
| `/api/consolidate` | POST | Trigger memory consolidation |
| `/api/reindex` | POST | Re-index vectors |

## MCP Tools

Once configured, these tools are available in Claude:

| Tool | Description |
|------|-------------|
| `remember` | Store a memory with metadata |
| `recall` | Semantic search (supports quality_boost) |
| `recall_by_tags` | Tag-based search |
| `proactive_context` | Surface relevant memories |
| `list_memories` | List all memories |
| `forget` | Delete by ID |
| `forget_by_tags` | Delete by tags |
| `update_memory` | Update memory metadata |
| `memory_stats` | Get statistics |
| `context_summary` | Recent learnings/decisions |
| `consolidate` | Trigger memory consolidation |

## Deploying Your Own Instance

**First-time deploying the Worker?** See the complete [Installation Guide - Part 1: Worker Deployment](docs/INSTALLATION.md#part-1-worker-deployment-first-time-only) for detailed steps with verification.

### Quick Reference

```bash
# 1. Create D1 database
wrangler d1 create shodh-memory

# 2. Create Vectorize index
wrangler vectorize create shodh-vectors --dimensions=384 --metric=cosine

# 3. Configure wrangler.toml
cp worker/wrangler.toml.example worker/wrangler.toml
# Edit with your database ID

# 4. Initialize schema
cd worker
wrangler d1 execute shodh-memory --file=../schema.sql --remote

# 5. Set API key
wrangler secret put API_KEY

# 6. Deploy
npm install
npm run deploy
```

**Prerequisites**: Cloudflare account (free tier OK), Node.js 18+, Wrangler CLI

For troubleshooting Worker deployment issues, see [Troubleshooting - Worker Deployment](docs/TROUBLESHOOTING.md#worker-deployment-issues).

## Memory Types

- `Observation` - General observations
- `Decision` - Decisions made
- `Learning` - Things learned
- `Error` - Error resolutions
- `Discovery` - Discoveries
- `Pattern` - Recognized patterns
- `Context` - Contextual information
- `Task` - Task-related
- `Conversation` - Auto-ingested conversations

## OpenAPI Specification Compliance

This implementation follows the [SHODH Memory API Specification v1.0.0](specs/README.md), ensuring compatibility across the SHODH ecosystem.

**✅ Fully Compliant Endpoints:**
- `POST /api/remember` - Store memories with full metadata support
- `POST /api/recall` - Semantic search with vector embeddings
- `POST /api/recall/by-tags` - Tag-based memory retrieval
- `POST /api/context` - Proactive context surfacing
- `DELETE /api/forget/{id}` - Delete specific memory
- `POST /api/forget/by-tags` - Bulk delete by tags
- `GET /api/memories` - List all memories with pagination
- `GET /api/memory/{id}` - Get specific memory
- `POST /api/consolidate` - Memory consolidation with Hebbian associations
- `GET /api/stats` - Memory statistics
- `GET /api/tags` - List all unique tags

**Schema Compliance:**
All unified fields from the specification are supported:
- **Core**: `content`, `content_hash`, `type`, `tags`
- **Source & Trust**: `source_type`, `credibility`
- **Emotional Metadata**: `emotion`, `emotional_valence`, `emotional_arousal`
- **Episodic Memory**: `episode_id`, `sequence_number`, `preceding_memory_id`
- **Quality & Access**: `quality_score`, `access_count`, `last_accessed_at`

For complete API documentation, see [specs/openapi.yaml](specs/openapi.yaml).

## Acknowledgments

This project is inspired by and compatible with [SHODH Memory](https://github.com/varun29ankuS/shodh-memory) by [@varun29ankuS](https://github.com/varun29ankuS). SHODH's innovative approach to AI memory - including emotional metadata, episodic structure, and Hebbian-style associations - provided the foundation for this edge implementation.

See [JOURNEY.md](JOURNEY.md) for detailed insights from our development process.

## Getting Help

### Documentation

- 📋 [Prerequisites & Requirements](docs/PREREQUISITES.md) - Before you start
- 📚 [Installation Guide](docs/INSTALLATION.md) - Step-by-step setup
- 🔧 [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- ❓ [FAQ](docs/FAQ.md) - Frequently asked questions
- 🖥️ [Multi-Device Setup](docs/MULTI_DEVICE.md) - Adding more devices

### Quick Checks

**Is it installed correctly?**
```bash
./scripts/verify-installation.sh
```

**Worker not responding?**
```bash
curl https://your-worker.your-subdomain.workers.dev/
# Should return: {"message":"SHODH Memory API is running"}
```

**Claude Desktop not seeing MCP tools?**
1. Check config file location for your OS
2. Restart Claude Desktop
3. See [Troubleshooting - MCP Bridge Not Starting](docs/TROUBLESHOOTING.md#mcp-bridge-not-starting)

### Support

- **Bug reports**: [GitHub Issues](https://github.com/YOUR_USER/shodh-cloudflare/issues)
- **Questions**: Check [FAQ](docs/FAQ.md) first
- **Discussions**: GitHub Discussions

## License

MIT
