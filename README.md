# SHODH on Cloudflare

**Version 2.0** - AI-Powered Memory with Natural Language Temporal Queries

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

## What's New in v2.0

🎯 **Natural Language Temporal Queries** - 65+ temporal expressions in English & German
- "last week", "letzte Woche", "KW 49", "seit Montag"
- Voice dictation support: "KW eins" (number words)
- Week ranges: "from KW 1 to KW 5"

🤖 **AI Summarization** - Get spoken summaries of your memories
- Perfect for Siri Shortcuts & Apple Watch
- Bilingual support (German/English)

📅 **Calendar Week (KW) Support** - ISO 8601 compliant
- German: "KW 49", "Kalenderwoche 3"
- English: "week 52", "CW 49"

🎙️ **Voice Input AI Classification** - Automatic cleanup & tagging
- Corrects dictation errors
- Smart memory type detection
- Auto-generates relevant tags

🔧 **Custom Timestamps** - Backdate memories for historical imports

🔌 **Gemini Client Support** - Works with Claude & Gemini models

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

### Obsidian Integration

**[Obsidian Shodh Sync Plugin](https://github.com/doobidoo/obsidian-shodh-sync)** - Sync your Shodh memories directly into your Obsidian vault with hierarchical folder organization (Year/Month). Available in the Obsidian Community Plugin Store.

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
| `/api/remember` | POST | Store a memory (with AI classification for voice inputs, custom timestamps) |
| `/api/recall` | POST | Semantic search (quality boost, 65+ temporal patterns, range queries, AI summarization) |
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
| `remember` | Store a memory with metadata (supports custom timestamps) |
| `recall` | Semantic search (quality boost, temporal range queries with 65+ natural language patterns) |
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

## AI Classification (Voice Inputs)

When memories are submitted from voice interfaces (Siri Shortcuts, Apple Watch), the Worker automatically:

1. **Corrects dictation errors** - Fixes typos, grammar, and recognition mistakes
2. **Classifies the memory type** - Determines if it's a learning, decision, task, etc.
3. **Generates relevant tags** - Creates 2-4 contextual tags

**Triggered by `source_type`:**
- `siri-shortcut` - iOS Shortcuts via Siri
- `siri-shortcut-ai` - iOS Shortcuts with Apple Intelligence
- `watch` - Apple Watch voice input

**Technology:**
- Cloudflare Workers AI
- Model: `@cf/meta/llama-3.1-8b-instruct`
- JSON Mode for reliable structured output

**Example:**
```bash
curl -X POST https://your-worker.workers.dev/api/remember \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"ich habe gelernt dass workars ai kostenlos ist","source_type":"siri-shortcut"}'

# Response includes:
# "ai_processed": true,
# "memory_type": "learning",
# "tags": ["learning", "cloudflare", "workers-ai"]
# Content corrected to: "Ich habe gelernt, dass Workers AI kostenlos ist"
```

**Note:** AI classification is only triggered for voice inputs. Regular API calls (MCP, direct) preserve the user-provided type and tags.

## Temporal Query Expressions

V2.0 introduces **65+ natural language patterns** for querying memories by time:

### Pattern Categories

**Basic Keywords** (English & German):
- `today` / `heute`
- `yesterday` / `gestern`
- `this week` / `diese woche`

**Extended Patterns**:
- `last week` / `letzte woche`
- `this month` / `diesen monat`
- `last year` / `letztes jahr`

**Flexible N-Unit Patterns**:
- `last 7 days` / `letzten 7 Tage`
- `past 3 weeks` / `letzten 3 Wochen`
- `vor 2 Monaten`

**Weekday References**:
- `monday` / `montag` (most recent)
- `last friday` / `letzten freitag`
- `seit dienstag`

**Calendar Weeks (ISO 8601)**:
- German: `KW 49`, `KW 1 2024`, `Kalenderwoche 3`
- English: `week 52`, `week 1 2024`, `CW 49`
- Voice dictation: `KW eins`, `week five`

**Range Queries**:
```bash
# Week ranges
{"from": "KW 1 2024", "to": "KW 5 2024"}

# Mixed ranges
{"from": "last month", "to": "yesterday"}

# Alias support
{"since": "monday", "until": "today"}
```

**Legacy Formats**:
- `7d`, `30d` (N days ago)
- ISO date strings

All patterns are **case-insensitive** and work in both **English and German**.

## AI Summarization (Voice Recall)

The `/api/recall` endpoint supports AI-powered summarization for voice interfaces:

**Parameters:**
- `summarize: true` - Enable AI summarization of search results
- `language: "de" | "en"` - Summary language (default: German)
- `since: string` - Time filter (65+ natural language patterns supported)
- `from` / `to` - Range queries with temporal expressions
- `before` / `until` - Upper bound filters

**Example (Siri Shortcut use case):**
```bash
curl -X POST https://your-worker.workers.dev/api/recall \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"was habe ich heute gemacht","summarize":true,"since":"today","language":"de"}'

# Response includes:
# "summary": "Heute hast du an der Cloudflare Worker Integration gearbeitet...",
# "summarized": true,
# "since": "today",
# "since_parsed": "2026-01-31T00:00:00.000Z"
```

**How it works with time filter:**
1. Filters memories by date from D1 database (max 50 candidates)
2. Ranks filtered memories by semantic similarity to query
3. AI summarizes the top results in natural language

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

## Migration from v1.x to v2.0

### Breaking Changes
**None** - v2.0 is fully backwards compatible with v1.x API calls.

### Recommended Updates

1. **MCP Bridge** - Update dependencies:
   ```bash
   cd mcp-bridge
   npm install
   ```
   This upgrades MCP SDK from 1.0.0 to >=1.8.0 for tool annotations support.

2. **New Features** (opt-in):
   - Temporal queries: Use enhanced `since` parameter with natural language
   - AI summarization: Add `summarize: true` to `/api/recall` calls
   - Custom timestamps: Specify `created_at` when creating memories
   - Range queries: Use `from`/`to` for date ranges

3. **No Worker Redeployment Required** - API is backwards compatible

### What Users Gain

- **Richer temporal queries**: "last week" instead of calculating dates
- **Voice-friendly**: Natural language works with Siri/dictation
- **Better voice recall**: AI summaries for spoken responses
- **Historical data**: Backdate memories with custom timestamps

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
