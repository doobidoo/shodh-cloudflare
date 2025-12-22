# Shodh Cloudflare Skill

Persistent memory system for AI agents running on Cloudflare's edge network. Store decisions, learnings, and context that persists across conversations with global low-latency access.

## Installation

### With Claude Code

Add the skill directly to your Claude Code configuration:

```bash
# Copy the SKILL.md to your skills directory
mkdir -p ~/.claude/skills/shodh-cloudflare
cp skills/shodh-cloudflare/SKILL.md ~/.claude/skills/shodh-cloudflare/SKILL.md
```

### MCP Server Configuration

Add to your Claude Desktop/Claude Code config:

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
        "SHODH_CLOUDFLARE_URL": "https://your-worker.your-subdomain.workers.dev",
        "SHODH_CLOUDFLARE_API_KEY": "your-api-key"
      }
    }
  }
}
```

## What This Skill Teaches

This skill teaches Claude how to effectively use the Shodh Cloudflare memory system:

- **When to store memories** - Decisions, learnings, errors, patterns
- **How to structure memories** - Rich content, proper types, useful tags
- **Retrieval strategies** - Semantic search powered by vector embeddings
- **Best practices** - Proactive context, consistent tagging, periodic review

## Core Capabilities

| Capability | Description |
|------------|-------------|
| `proactive_context` | Automatically surface relevant memories every message |
| `remember` | Store new memories with type and tags |
| `recall` | Semantic search across all memories |
| `list_memories` | Browse all stored memories |
| `forget` | Delete specific memories |
| `forget_by_tags` | Bulk delete by tags |
| `memory_stats` | Get statistics and health info |
| `context_summary` | Quick overview of recent learnings |

## Example Usage

```
User: "What authentication approach should we use?"

Claude (with skill):
1. Calls proactive_context to surface past auth decisions
2. Recalls any security-related memories
3. Responds with context-aware recommendation
4. Stores the decision for future reference
```

## Architecture

This skill integrates with the Shodh Cloudflare backend:

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
```

## Requirements

- Shodh Cloudflare worker deployed (or access to a hosted instance)
- Claude Code, Claude.ai, or any MCP-compatible client
- Node.js 18+ (for MCP bridge)

## Memory Types

| Type | Purpose |
|------|---------|
| `Decision` | User choices, architectural decisions |
| `Learning` | New knowledge gained |
| `Error` | Bugs found and fixes |
| `Discovery` | Insights and aha moments |
| `Pattern` | Recurring behaviors |
| `Context` | Background information |
| `Task` | Work in progress |
| `Observation` | General notes |
| `Conversation` | Auto-ingested conversations |

## Links

- [GitHub Repository](https://github.com/YOUR_USER/shodh-cloudflare)
- [Parent Project: SHODH Memory](https://github.com/varun29ankuS/shodh-memory)

## Acknowledgments

This skill is adapted from the [SHODH Memory skill](https://github.com/varun29ankuS/shodh-memory) by [@varun29ankuS](https://github.com/varun29ankuS), optimized for the Cloudflare edge deployment.

## License

MIT
