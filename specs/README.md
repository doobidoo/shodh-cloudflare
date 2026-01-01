# SHODH Memory API Specification

Shared API specification for interoperable memory implementations.

## Goal

Define a common interface that allows:
- Seamless switching between backends (local, edge, cloud)
- Migration between implementations (with re-embedding)
- Hybrid setups (local for sensitive data, edge for sync)

## Format

- **[openapi.yaml](./openapi.yaml)** - Machine-readable API definition (OpenAPI 3.1)
- **[schemas/memory.md](./schemas/memory.md)** - Human-readable schema documentation

## Quick Start

### Store a Memory

```bash
curl -X POST https://your-api/api/remember \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Use JWT tokens with 24h expiry",
    "type": "Decision",
    "tags": ["auth", "security"]
  }'
```

### Search Memories

```bash
curl -X POST https://your-api/api/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication decisions",
    "limit": 5
  }'
```

## Core Operations

| Operation | Method | Endpoint | Description |
|-----------|--------|----------|-------------|
| `remember` | POST | /api/remember | Store a new memory |
| `recall` | POST | /api/recall | Semantic search across memories |
| `recall_by_tags` | POST | /api/recall/by-tags | Tag-based filtering |
| `context` | POST | /api/context | Proactive context surfacing |
| `forget` | DELETE | /api/forget/{id} | Delete memory by ID |
| `consolidate` | POST | /api/consolidate | Trigger decay/consolidation |
| `list` | GET | /api/memories | List with pagination |
| `stats` | GET | /api/stats | Memory statistics |

## Memory Schema Highlights

### Core Fields

```yaml
Memory:
  content: string        # The memory content (required)
  type: MemoryType       # Classification (Decision, Learning, etc.)
  tags: string[]         # User-defined tags
  source_type: SourceType # Where it came from (user, api, file, etc.)
  credibility: float     # Trust score (0.0-1.0)
```

### Emotional Metadata

```yaml
emotion: string           # Label (joy, frustration, curiosity, etc.)
emotional_valence: float  # -1.0 (negative) to +1.0 (positive)
emotional_arousal: float  # 0.0 (calm) to 1.0 (aroused)
```

### Episodic Structure

```yaml
episode_id: string        # Groups related memories
sequence_number: integer  # Order within episode
```

See [schemas/memory.md](./schemas/memory.md) for complete field documentation.

## Implementations

| Project | Backend | Embeddings | Status |
|---------|---------|------------|--------|
| [shodh-memory](https://github.com/varun29ankuS/shodh-memory) | RocksDB (local) | MiniLM-L6-v2 (ONNX) | Reference |
| [shodh-cloudflare](https://github.com/doobidoo/shodh-cloudflare) | D1 + Vectorize (edge) | Workers AI (bge-small) | Production |
| [mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) | SQLite-vec / Hybrid | MiniLM-L6-v2 (ONNX) | Production |

## Migration Notes

Different embedding models produce incompatible vector spaces. When migrating:

1. Export memories from source
2. Re-embed all content with target model
3. Import to target system

The API contract remains the same; only the embeddings change.

## Authentication

All endpoints (except `/api/health`) require Bearer token authentication:

```
Authorization: Bearer your-api-key
```

## Versioning

This specification follows semantic versioning:
- **Major**: Breaking changes to required fields or core operations
- **Minor**: New optional fields or operations
- **Patch**: Documentation fixes, clarifications

Current version: **1.0.0**

## Contributing

PRs welcome! To propose changes:

1. Fork this repository
2. Edit `openapi.yaml` or `schemas/memory.md`
3. Ensure changes are backwards-compatible (or bump major version)
4. Submit PR with rationale

## Related Documents

- [CODEBASE_INTEGRATION.md](./CODEBASE_INTEGRATION.md) - Codebase awareness specification (draft)

## License

MIT - See repository root for details.
