# SHODH on Cloudflare

A globally distributed, SHODH-compatible memory system running on Cloudflare's edge network.

> Inspired by [SHODH Memory](https://github.com/varun29ankuS/shodh-memory) by [@varun29ankuS](https://github.com/varun29ankuS)
> Read our [Development Journey](JOURNEY.md) for insights and learnings.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Cloudflare Edge                     │
│  ┌─────────────┐   ┌──────────┐   ┌──────────┐  │
│  │   Worker    │──▶│    D1    │   │Vectorize │  │
│  │  (API)      │   │(metadata)│   │(vectors) │  │
│  └──────┬──────┘   └──────────┘   └──────────┘  │
│         │                                        │
│         ▼                                        │
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

## Quick Start (New Device)

### Option 1: Automated Setup

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USER/shodh-cloudflare/main/scripts/setup-client.sh | bash
```

### Option 2: Manual Setup

```bash
# 1. Clone and setup
git clone https://github.com/YOUR_USER/shodh-cloudflare.git
cd shodh-cloudflare/mcp-bridge
npm install

# 2. Add to Claude Desktop config
# See Configuration section below
```

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

### Prerequisites

- Cloudflare account
- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)

### Steps

1. **Create D1 Database**
   ```bash
   npx wrangler d1 create shodh-memory
   ```

2. **Create Vectorize Index**
   ```bash
   npx wrangler vectorize create shodh-vectors --dimensions=384 --metric=cosine
   ```

3. **Initialize Schema**
   ```bash
   npx wrangler d1 execute shodh-memory --file=./schema.sql
   ```

4. **Configure wrangler.toml**
   ```bash
   cp worker/wrangler.toml.example worker/wrangler.toml
   # Edit with your database IDs
   ```

5. **Set API Key**
   ```bash
   cd worker
   npx wrangler secret put API_KEY
   ```

6. **Deploy**
   ```bash
   cd worker
   npm install
   npx wrangler deploy
   ```

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

## License

MIT
