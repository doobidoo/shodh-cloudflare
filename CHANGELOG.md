# Changelog

All notable changes to SHODH on Cloudflare will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **AI Summarization for Memory Recall**: New `summarize` parameter for `/api/recall` endpoint
  - Uses Cloudflare Workers AI with `@cf/meta/llama-3.1-8b-instruct` model
  - Returns natural language summary of search results
  - Supports `language` parameter (`de`/`en`) for response language
  - Ideal for voice interfaces (Siri Shortcuts) to get spoken summaries
- **Enhanced Temporal Query Parser**: Significantly expanded `since` parameter support in `/api/recall` endpoint
  - **Basic keywords**: `today`/`heute`, `yesterday`/`gestern`, `this week`/`diese woche`
  - **Extended fixed patterns**: `last week`/`letzte woche`, `this month`/`diesen monat`, `last month`/`letzten monat`, `this year`/`dieses jahr`, `last year`/`letztes jahr`
  - **Flexible N-unit patterns**: `last N days`, `past N weeks`, `letzten N Monate`, etc.
  - **Weekday references**: `monday`/`montag`, `last monday`/`letzten montag`
  - **Seit/Since expressions**: `seit gestern`, `since monday`, `seit diesem monat`
  - **Legacy support**: `7d`, `30d` (N days ago), ISO date strings
  - When `since` is set, uses time-first strategy: filter by date from D1, then rank by semantic similarity
- **Temporal Range Filters**: Extended `/api/recall` endpoint with `before`/`until`/`to` parameters and aliases for range queries
  - `before`/`until`/`to`: Upper bound filter (memories before/up to a date)
  - `from`: Alias for `since` (lower bound)
  - `to`: Alias for `before`/`until` (upper bound)
  - Range queries: `from` + `to` for date ranges (e.g., "last month" to "last week")
  - All 51 natural language patterns supported for both bounds
  - Date range validation: returns 400 if lower bound > upper bound
  - Backwards compatible: `since` parameter unchanged
  - Alias precedence: `from` > `since` for lower bound; `to` > `until` > `before` for upper bound
- **Calendar Week (KW) Support**: Extended temporal query parser with calendar week patterns
  - German: `KW 49`, `KW49`, `KW 1 2024`, `Kalenderwoche 3`
  - English: `week 52`, `week52`, `week 1 2024`, `CW 49`
  - ISO 8601 standard (week starts Monday, week 1 has first Thursday)
  - Week range queries: `from: "KW 1 2024", to: "KW 5 2024"`
  - Mixed queries: `from: "KW 1", to: "yesterday"`
  - 14 new patterns (7 German, 7 English)
  - Total: 65 temporal patterns (51 existing + 14 new)
- **Custom Timestamp Support**: Added optional `created_at` parameter to `/api/remember` endpoint
  - Allows backdating memories for historical data import and weekly summary consolidation
  - ISO 8601 format validation (e.g., "2024-12-05T12:00:00Z")
  - Cannot be in the future (future dates rejected with 400 error)
  - Defaults to current time if not provided
  - Use case: Create weekly summaries with KW-appropriate timestamps
  - `updated_at` remains independent (always uses current time)
  - Backwards compatible: existing API clients unaffected
- **Comprehensive Temporal Parser Tests**: Added Vitest test suite with 71+ tests for temporal expression parser
  - Extracted `parseTemporalExpression()` to separate module (`worker/src/temporal-parser.ts`) for testability
  - Dependency injection via optional `now` parameter enables deterministic testing with fixed dates
  - 71 test cases covering all 65 temporal patterns + edge cases and invalid inputs
  - Test categories: Basic Keywords (6), Extended Patterns (13), N-Unit Patterns (15), Weekdays (6), Seit/Since (8), Legacy (3), Calendar Weeks (14), Invalid Input (5)
  - All patterns: English & German, case-insensitive, year boundaries handled
  - 100% code coverage target for temporal-parser.ts
  - Run with: `npm test`, `npm run test:coverage`, `npm run test:ui`
  - Test documentation in `worker/TESTING.md`
  - CI/CD ready (test scripts in package.json)
- **Temporal Query Parser Enhancement Prompt**: Added `prompts/temporal-query-parser-enhancement.md` for future implementation of full natural language temporal parsing (matching SecondBrain iOS TemporalQueryParser)
- **AI Classification for Voice Inputs**: Automatic dictation correction, memory type classification, and tag generation for voice inputs (Siri Shortcuts, Apple Watch)
  - Uses Cloudflare Workers AI with `@cf/meta/llama-3.1-8b-instruct` model
  - JSON Mode for reliable structured output
  - Triggered by `source_type` in: `siri-shortcut`, `siri-shortcut-ai`, `watch`
  - Returns `ai_processed`, `memory_type`, and `tags` in API response
- **Gemini Client Support**: Added configuration and scripts to support Gemini-based clients alongside the existing Claude client.
- Created `skills/shodh-cloudflare/SKILL_GEMINI.md` to provide tool-use instructions formatted for Gemini models.
- Created `hooks/gemini-code-ingest-smart.ps1`, a PowerShell script for automated memory ingestion for Gemini clients.
- **MCP Tool Annotations**: Added `annotations` with `title`, `readOnlyHint`, and `destructiveHint` to all 11 MCP tools (inspired by [mcp-memory-service PR #328](https://github.com/doobidoo/mcp-memory-service/pull/328))

### Changed
- Updated `README.md` with AI Classification documentation
- Updated `README.md` to provide distinct configuration instructions for both Claude Desktop and generic Gemini clients.
- Upgraded MCP SDK from `^1.0.0` to `>=1.8.0` (required for ToolAnnotations)
- Bumped mcp-bridge version to 1.1.1
- Worker version bumped to 1.1.0

---

## [1.1.0] - 2026-01-02

### Added

#### OpenAPI Specification Compliance
- **specs/ directory** with complete OpenAPI 3.1 specification from parent repo
  - `specs/openapi.yaml` - Machine-readable API definition
  - `specs/schemas/memory.md` - Human-readable schema documentation
  - `specs/README.md` - Quick start guide

#### New API Endpoints
- `GET /api/health` - Detailed health check endpoint (OpenAPI compliant)
- `POST /api/recall/by-tags` - Tag-based memory search without vector query
- `PATCH /api/memories/:id` - Update memory metadata (tags, type, emotions, etc.)
- `POST /api/consolidate` - Trigger memory consolidation with exponential decay

#### Quality-Boosted Search
- `/api/recall` now supports `quality_boost` and `quality_weight` parameters
- Over-fetches 3x candidates and re-ranks by composite score
- Composite score: `(1 - weight) * semantic + weight * quality`

#### New MCP Tools (3 new, 1 enhanced)
- `recall_by_tags` - Tag-based search
- `update_memory` - Update memory metadata
- `consolidate` - Trigger memory consolidation
- `recall` - Enhanced with quality_boost/quality_weight parameters

### Changed
- Route consistency: `/api/memory/:id` renamed to `/api/memories/:id`
- README.md updated with new endpoints and tools

### Notes
This release aligns shodh-cloudflare with the unified SHODH Memory API specification
defined in [PR #3](https://github.com/varun29ankuS/shodh-memory/pull/3).

---

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
