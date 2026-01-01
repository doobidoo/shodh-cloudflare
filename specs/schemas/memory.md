# Memory Schema Documentation

Human-readable documentation for the unified SHODH Memory schema.

## Core Memory Object

Every memory implementation must support these fields:

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier for the memory |
| `content` | string | The actual memory content |
| `content_hash` | string | SHA-256 hash for deduplication |
| `created_at` | datetime | When the memory was created |

### Classification Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | enum | `Observation` | Memory type classification |
| `tags` | string[] | `[]` | User-defined tags for categorization |

#### Memory Types

```
Observation  - General observations and notes
Decision     - Decisions made with rationale
Learning     - Things learned from experience
Error        - Error resolutions and debugging insights
Discovery    - New discoveries and insights
Pattern      - Recognized patterns in code or behavior
Context      - Contextual background information
Task         - Task-related notes and progress
CodeEdit     - Code modifications made
FileAccess   - Files read or accessed
Search       - Search queries and results
Command      - Commands executed
Conversation - Auto-ingested conversation context
```

### Source & Trust Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `source_type` | enum | `user` | Where the memory originated |
| `credibility` | float | `1.0` | Trust score (0.0-1.0) |

#### Source Types

```
user         - Direct user input
system       - System-generated events
api          - External API responses
file         - Content from files
web          - Web content
ai_generated - AI-generated content
inferred     - Inferred from context
```

### Emotional Metadata (Optional)

These fields capture the emotional context of memories, useful for:
- Understanding decision-making context
- Prioritizing memories during recall
- Building more human-like memory systems

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `emotion` | string | - | Emotion label (joy, frustration, surprise, etc.) |
| `emotional_valence` | float | -1.0 to 1.0 | Negative to positive sentiment |
| `emotional_arousal` | float | 0.0 to 1.0 | Calm to aroused intensity |

#### Common Emotion Labels

```
joy          - Positive achievement or success
frustration  - Obstacles or difficulties
surprise     - Unexpected findings
relief       - Problem resolution
curiosity    - Exploration and learning
confusion    - Uncertainty or complexity
satisfaction - Task completion
anxiety      - Concerns or worries
```

#### Valence-Arousal Examples

| Emotion | Valence | Arousal |
|---------|---------|---------|
| Excited | +0.8 | 0.9 |
| Calm | +0.3 | 0.1 |
| Frustrated | -0.7 | 0.8 |
| Sad | -0.5 | 0.2 |
| Curious | +0.4 | 0.5 |

### Episodic Memory Fields (Optional)

For threading related memories into coherent episodes:

| Field | Type | Description |
|-------|------|-------------|
| `episode_id` | string | Groups related memories together |
| `sequence_number` | integer | Order within the episode |

#### Episode Example

```json
[
  {
    "content": "Starting authentication implementation",
    "episode_id": "auth-impl-2024",
    "sequence_number": 1
  },
  {
    "content": "Decided to use JWT tokens",
    "episode_id": "auth-impl-2024",
    "sequence_number": 2,
    "type": "Decision"
  },
  {
    "content": "Completed OAuth2 integration",
    "episode_id": "auth-impl-2024",
    "sequence_number": 3
  }
]
```

### Timestamp Fields

| Field | Type | Description |
|-------|------|-------------|
| `created_at` | datetime | When memory was created |
| `updated_at` | datetime | When memory was last modified |
| `last_accessed_at` | datetime | When memory was last retrieved |

### Quality & Access Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `quality_score` | float | - | AI-evaluated quality (0.0-1.0) |
| `access_count` | integer | `0` | Number of times retrieved |

#### Quality Scoring

Quality scores help prioritize memories during:
- Search result ranking
- Consolidation decisions
- Memory decay calculations

```
0.8-1.0  High quality   - Preserved longest
0.5-0.7  Medium quality - Standard retention
0.0-0.4  Low quality    - Candidates for archival
```

### Implementation-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `embedding` | float[] | Vector embedding (dimensions vary) |
| `metadata` | object | Custom implementation-specific data |

#### Embedding Dimensions by Implementation

| Implementation | Model | Dimensions |
|----------------|-------|------------|
| shodh-memory | MiniLM-L6-v2 | 384 |
| shodh-cloudflare | bge-small-en-v1.5 | 384 |
| mcp-memory-service | MiniLM-L6-v2 | 384 |

---

## Complete Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "Use JWT tokens with 24h expiry and refresh tokens for mobile apps",
  "content_hash": "a1b2c3d4e5f6...",
  "type": "Decision",
  "tags": ["auth", "security", "mobile"],

  "source_type": "user",
  "credibility": 0.95,

  "emotion": "satisfaction",
  "emotional_valence": 0.7,
  "emotional_arousal": 0.4,

  "episode_id": "auth-implementation-2024",
  "sequence_number": 3,

  "created_at": "2024-12-30T10:00:00Z",
  "updated_at": "2024-12-30T14:30:00Z",
  "last_accessed_at": "2024-12-30T16:00:00Z",

  "quality_score": 0.85,
  "access_count": 5,

  "metadata": {
    "project": "mobile-app",
    "reviewer": "security-team"
  }
}
```

---

## Field Compatibility Matrix

| Field | shodh-memory | shodh-cloudflare | mcp-memory-service |
|-------|--------------|------------------|-------------------|
| `id` | UUID | UUID | content_hash |
| `content` | string | string | string |
| `content_hash` | SHA-256 | SHA-256 | SHA-256 |
| `type` | enum | enum | string (flexible) |
| `tags` | string[] | JSON string | string[] |
| `source_type` | enum | enum | metadata field |
| `credibility` | float | float | quality_score |
| `emotion` | string | string | metadata field |
| `emotional_valence` | float | float | metadata field |
| `emotional_arousal` | float | float | metadata field |
| `episode_id` | string | string | metadata field |
| `sequence_number` | int | int | metadata field |
| `quality_score` | float | float | float |
| `access_count` | int | int | int |
| `embedding` | float[384] | float[384] | float[384] |

---

## Migration Notes

### Between Implementations

1. **Export memories** from source system
2. **Transform fields** to match target schema
3. **Re-embed content** (different models = different vectors)
4. **Import to target** with new embeddings

### Embedding Incompatibility

Different embedding models produce incompatible vector spaces:

```
MiniLM-L6-v2 embedding    =/=    bge-small-en-v1.5 embedding
```

Always re-embed when migrating between implementations with different models.

### Graceful Degradation

If a field is not supported by an implementation:
- Store it in `metadata` if possible
- Omit it without error
- Document the limitation

---

## Best Practices

### Tags

- Use lowercase, hyphenated tags: `user-auth`, `bug-fix`
- Limit to 5-10 tags per memory
- Use consistent vocabulary across memories

### Emotional Metadata

- Only add when emotionally significant
- Use valence+arousal together or not at all
- Common emotions: joy, frustration, curiosity, relief

### Episodes

- Group logically related memories
- Use descriptive episode IDs: `feature-auth-2024`, `bugfix-123`
- Keep episodes to 3-10 memories for coherence

### Quality Scores

- Let the system score automatically when possible
- Manual overrides: use user ratings (thumbs up/down)
- Review low-quality memories periodically
