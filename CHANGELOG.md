# Changelog

All notable changes to SHODH on Cloudflare will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-20

### Added

#### Core Infrastructure
- **Cloudflare Worker** REST API implementation using Hono framework
- **D1 Database** schema with memories and memory_edges tables
- **Vectorize Integration** for semantic search with 384-dimensional embeddings
- **Workers AI** integration using @cf/baai/bge-small-en-v1.5 model
- **MCP Bridge** Node.js server for Claude Desktop integration

#### API Endpoints
- `GET /` - Health check endpoint
- `POST /api/remember` - Store new memories with rich metadata
- `POST /api/recall` - Semantic search with hybrid retrieval modes
- `POST /api/context` - Proactive context surfacing with auto-ingestion
- `GET /api/memories` - List memories with filtering and pagination
- `GET /api/memory/:id` - Retrieve specific memory
- `DELETE /api/forget/:id` - Delete memory by ID
- `POST /api/forget/by-tags` - Bulk deletion by tags
- `GET /api/tags` - List all unique tags
- `GET /api/stats` - Memory statistics
- `POST /api/reindex` - Re-index all vectors

#### SHODH-Compatible Features
- **Emotional Metadata**: valence, arousal, emotion labels
- **Episodic Memory**: episode_id, sequence_number, preceding_memory_id
- **Hebbian Memory Edges**: Association table with weight and co-activation tracking
- **Quality & Credibility**: quality_score and credibility fields
- **Memory Types**: Observation, Decision, Learning, Error, Discovery, Pattern, Context, Task, CodeEdit, FileAccess, Search, Command, Conversation
- **Source Types**: user, system, api, file, web, ai_generated, inferred

#### MCP Tools (8 tools)
- `remember` - Store memories with full metadata support
- `recall` - Semantic search (semantic/associative/hybrid modes)
- `proactive_context` - Auto-surface relevant memories
- `list_memories` - List with filters
- `forget` - Delete by ID
- `forget_by_tags` - Delete by tags
- `memory_stats` - Statistics
- `context_summary` - Recent learnings/decisions summary

#### Documentation
- **README.md**: Complete user documentation with architecture diagram
- **JOURNEY.md**: Development insights, origin story, and technical learnings
- **schema.sql**: Annotated database schema
- **wrangler.toml.example**: Configuration template

#### Deployment & Setup
- **Automated setup script** (scripts/setup-client.sh) for new devices
- **Multi-OS support**: macOS, Windows, Linux configuration paths
- **Security best practices**: Environment variables, no hardcoded secrets
- **Git safety**: .gitignore with proper exclusions

### Technical Highlights

#### Architecture Decisions
- **Edge-Native Design**: Fully serverless on Cloudflare's global network
- **Stateless Workers**: All state in D1/Vectorize for horizontal scaling
- **Hybrid Storage**: D1 for metadata, Vectorize for vectors
- **Content Hashing**: SHA-256 for deduplication

#### Performance Characteristics
- **Global Latency**: <50ms (edge deployment across 300+ cities)
- **Embedding Generation**: On-edge with Workers AI (no external API calls)
- **Vector Search**: Cosine similarity with metadata filtering
- **Scalability**: Automatic scaling, pay-per-use model

#### Security Features
- **Bearer Token Authentication**: API key protection for all endpoints
- **Environment-Based Config**: No secrets in code
- **Wrangler Secrets**: Secure API key management
- **Clean Git History**: No sensitive data in repository

### Acknowledgments

This initial release was inspired by:
- **SHODH Memory** by [@varun29ankuS](https://github.com/varun29ankuS) - Original architecture and innovation
- **MCP Memory Service** by [@doobidoo](https://github.com/doobidoo) - Sibling project that led to discovery

### Notes

This is the initial public release after completing:
1. Core implementation (worker + MCP bridge)
2. Documentation (README + JOURNEY)
3. Security cleanup (Git history sanitization)
4. Origin story documentation

The project is production-ready for personal use and ready for community contributions.

---

**Full Changelog**: https://github.com/doobidoo/shodh-cloudflare/commits/v1.0.0
