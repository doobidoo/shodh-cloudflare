# SHODH on Cloudflare

A globally distributed, SHODH-compatible memory system running on Cloudflare's edge network.

> Inspired by [SHODH Memory](https://github.com/varun29ankuS/shodh-memory) by [@varun29ankuS](https://github.com/varun29ankuS)
> Read our [Development Journey](JOURNEY.md) for insights and learnings.

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

## Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **API** | Cloudflare Workers | REST API endpoint |
| **Metadata** | D1 (SQLite) | Memory content, tags, timestamps |
| **Vectors** | Vectorize | Semantic search embeddings |
| **Embeddings** | Workers AI | bge-small-en-v1.5 (384 dimensions) |
| **MCP Bridge** | Node.js | Claude Desktop integration |

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

## Quick Start (New Device)

> **First time installing?** See the [complete installation guide](docs/INSTALLATION.md) for Worker deployment + client setup.

> **Prerequisites**: Check [requirements](docs/PREREQUISITES.md) first (Node.js 18+, Cloudflare account)

### Option 1: Automated Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/YOUR_USER/shodh-cloudflare.git
cd shodh-cloudflare

# Run the setup script
./scripts/setup-client.sh
```

The script will:
- ✅ Verify prerequisites (Node.js, npm)
- ✅ Install MCP bridge dependencies
- ✅ Ask for your Worker URL and API key
- ✅ Validate Worker connectivity
- ✅ Generate Claude Desktop configuration
- ✅ Offer to run verification tests

### Option 2: Manual Setup

For manual setup instructions, see [Installation Guide - Manual Setup](docs/INSTALLATION.md#step-2b-manual-setup-alternative).

## Configuration

Add to your Claude Desktop config:

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
  }
}
```

After editing the config:
1. **Restart Claude Desktop** (important!)
2. Verify MCP server connection (see below)

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

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/remember` | POST | Store a memory |
| `/api/recall` | POST | Semantic search |
| `/api/context` | POST | Proactive context surfacing |
| `/api/memories` | GET | List all memories |
| `/api/memory/:id` | GET | Get specific memory |
| `/api/forget/:id` | DELETE | Delete memory |
| `/api/forget/by-tags` | POST | Delete by tags |
| `/api/tags` | GET | List all tags |
| `/api/stats` | GET | Memory statistics |
| `/api/reindex` | POST | Re-index vectors |

## MCP Tools

Once configured, these tools are available in Claude:

- `remember` - Store a memory
- `recall` - Semantic search
- `proactive_context` - Surface relevant memories
- `list_memories` - List all memories
- `forget` - Delete by ID
- `forget_by_tags` - Delete by tags
- `memory_stats` - Get statistics
- `context_summary` - Recent learnings/decisions

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
