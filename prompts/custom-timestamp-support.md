# Custom Timestamp Support for Memory Creation

## Objective

Add support for custom `created_at` timestamps when creating memories via `/api/remember` endpoint, enabling backdating of memories for historical data import and weekly summary consolidation.

## Current State

**File:** `worker/src/index.ts`

**Current Implementation:**
- `RememberRequest` interface (lines 42-55) does NOT have `created_at` parameter
- Memory creation (line ~560) uses `new Date().toISOString()` for both `created_at` and `updated_at`
- No way to specify custom timestamp when creating memories

**Limitation:** Cannot create memories with historical timestamps (e.g., weekly summaries backdated to their respective weeks).

## Requirements

### 1. Extend RememberRequest Interface

Add optional `created_at` parameter to `RememberRequest` (lines 42-55):

```typescript
interface RememberRequest {
  content: string;
  type?: string;
  tags?: string[];
  source_type?: string;
  emotion?: string;
  emotional_valence?: number;
  emotional_arousal?: number;
  credibility?: number;
  episode_id?: string;
  sequence_number?: number;
  preceding_memory_id?: string;
  created_at?: string;  // NEW: ISO 8601 timestamp (optional)
}
```

### 2. Update Memory Creation Logic

Modify `/api/remember` endpoint (around line 560):

**Current:**
```typescript
const now = new Date().toISOString();
const memoryId = generateId();

await c.env.DB.prepare(`
  INSERT INTO memories (
    id, content, content_hash, memory_type, tags,
    source_type, emotion, emotional_valence, emotional_arousal,
    credibility, quality_score, access_count, last_accessed_at,
    episode_id, sequence_number, preceding_memory_id,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  memoryId, body.content, contentHash, memoryType, tagsStr,
  sourceType, emotion, emotionalValence, emotionalArousal,
  credibility, qualityScore, 0, null,
  episodeId, sequenceNumber, precedingMemoryId,
  now, now  // Both created_at and updated_at = now
).run();
```

**New:**
```typescript
const now = new Date().toISOString();
const memoryId = generateId();

// Use provided created_at or default to now
const createdAt = body.created_at || now;

// Validate created_at format if provided
if (body.created_at) {
  const parsed = new Date(body.created_at);
  if (isNaN(parsed.getTime())) {
    return c.json({
      error: 'Invalid created_at format. Must be ISO 8601 (e.g., "2024-12-05T12:00:00Z")'
    }, 400);
  }
  // Prevent future dates
  if (parsed > new Date()) {
    return c.json({
      error: 'created_at cannot be in the future'
    }, 400);
  }
}

await c.env.DB.prepare(`
  INSERT INTO memories (
    id, content, content_hash, memory_type, tags,
    source_type, emotion, emotional_valence, emotional_arousal,
    credibility, quality_score, access_count, last_accessed_at,
    episode_id, sequence_number, preceding_memory_id,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  memoryId, body.content, content Hash, memoryType, tagsStr,
  sourceType, emotion, emotionalValence, emotionalArousal,
  credibility, qualityScore, 0, null,
  episodeId, sequenceNumber, precedingMemoryId,
  createdAt, now  // created_at = custom or now, updated_at = now
).run();
```

### 3. Validation Rules

**Timestamp Validation:**
- Must be valid ISO 8601 format (e.g., `2024-12-05T12:00:00Z`)
- Cannot be in the future
- Can be in the past (for backdating)
- Optional - defaults to current time if not provided

**Error Responses:**
```json
// Invalid format
{
  "error": "Invalid created_at format. Must be ISO 8601 (e.g., '2024-12-05T12:00:00Z')"
}

// Future date
{
  "error": "created_at cannot be in the future"
}
```

### 4. OpenAPI Specification Update

**File:** `specs/openapi.yaml`

Update `RememberRequest` schema (around line 440):

```yaml
RememberRequest:
  type: object
  required:
    - content
  properties:
    content:
      type: string
      minLength: 1
      description: Memory content
    # ... existing properties ...
    created_at:
      type: string
      format: date-time
      nullable: true
      description: |
        Custom creation timestamp in ISO 8601 format.
        Useful for backdating memories (e.g., historical data import).
        Defaults to current time if not provided.
        Cannot be in the future.
      example: "2024-12-05T12:00:00Z"
```

Add example to `/api/remember` endpoint:

```yaml
examples:
  backdated_memory:
    summary: Memory with custom timestamp
    value:
      content: "Weekly summary for KW 49"
      type: Context
      tags: ["weekly-summary", "kw49-2024"]
      created_at: "2024-12-05T12:00:00Z"
```

### 5. Use Cases

**Weekly Summary Consolidation:**
```bash
# Create KW 49 summary with timestamp in that week
curl -X POST /api/remember \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "KW 49 (2024-12-02 bis 2024-12-08): Projektstart...",
    "type": "Context",
    "tags": ["weekly-summary", "kw49-2024"],
    "created_at": "2024-12-05T12:00:00Z"
  }'

# Create KW 3 2026 summary with timestamp in that week
curl -X POST /api/remember \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "KW 3 (2026-01-13 bis 2026-01-19): DevOps Automation...",
    "type": "Context",
    "tags": ["weekly-summary", "kw3-2026"],
    "created_at": "2026-01-16T12:00:00Z"
  }'
```

**Historical Data Import:**
```bash
# Import old meeting notes with original date
curl -X POST /api/remember \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Project kickoff meeting: decided on tech stack",
    "type": "Decision",
    "tags": ["meeting", "project-alpha"],
    "created_at": "2024-01-15T14:30:00Z"
  }'
```

### 6. Testing Requirements

**Manual Tests:**

```bash
# Test 1: Normal creation (no created_at, defaults to now)
curl -X POST /api/remember \
  -d '{"content": "Test memory"}'
# Expected: created_at = current time

# Test 2: Valid backdated timestamp
curl -X POST /api/remember \
  -d '{"content": "KW 49 summary", "created_at": "2024-12-05T12:00:00Z"}'
# Expected: created_at = 2024-12-05T12:00:00Z

# Test 3: Invalid format
curl -X POST /api/remember \
  -d '{"content": "Test", "created_at": "2024-12-05"}'
# Expected: 400 error with format message

# Test 4: Future date
curl -X POST /api/remember \
  -d '{"content": "Test", "created_at": "2030-01-01T00:00:00Z"}'
# Expected: 400 error "cannot be in the future"

# Test 5: Valid timestamp with timezone
curl -X POST /api/remember \
  -d '{"content": "Test", "created_at": "2024-12-05T12:00:00+01:00"}'
# Expected: Success (JavaScript Date parses timezones)
```

**Verification Query:**
```bash
# Query memories from KW 49
curl -X POST /api/recall \
  -d '{"query": "summary", "from": "KW 49 2024", "to": "KW 49 2024"}'
# Expected: Returns backdated KW 49 summary
```

### 7. Edge Cases

**Timezone Handling:**
- JavaScript `new Date()` parses ISO 8601 with timezones automatically
- Store as-is in D1 (SQLite stores as TEXT)
- Comparisons work with ISO 8601 string format

**Duplicate Detection:**
- Content hash duplicate check happens BEFORE timestamp validation
- If duplicate exists, return existing memory (ignore custom timestamp)

**Updated_at Independence:**
- `updated_at` always uses current time (not affected by custom `created_at`)
- Allows tracking when memory was actually stored vs. its logical creation time

### 8. Documentation Updates

**Files to update:**

1. **CHANGELOG.md** - Add to Unreleased section:
   ```markdown
   - **Custom Timestamp Support**: Added optional `created_at` parameter to `/api/remember` endpoint
     - Allows backdating memories for historical data import
     - ISO 8601 format validation
     - Cannot be in the future
     - Defaults to current time if not provided
     - Use case: Weekly summary consolidation with KW-appropriate timestamps
   ```

2. **README.md** - Add example:
   ```markdown
   ### Creating Memories with Custom Timestamps

   Backdate memories for historical data:

   ```bash
   curl -X POST /api/remember \
     -d '{
       "content": "KW 49 summary",
       "created_at": "2024-12-05T12:00:00Z"
     }'
   ```
   ```

3. **specs/openapi.yaml** - Update schema and add examples (as shown above)

## Implementation Checklist

- [ ] Add `created_at?: string` to RememberRequest interface
- [ ] Add timestamp validation logic (format, not future)
- [ ] Update INSERT query to use custom or default timestamp
- [ ] Add error handling for invalid timestamps
- [ ] Update OpenAPI spec with new parameter
- [ ] Add examples to OpenAPI spec
- [ ] Update CHANGELOG.md
- [ ] Update README.md with usage examples
- [ ] Test all 5 manual test cases
- [ ] Verify KW queries work with backdated summaries
- [ ] Deploy to Cloudflare Workers
- [ ] Create git commit

## Success Criteria

1. ✅ Optional `created_at` parameter accepted
2. ✅ Defaults to current time when not provided
3. ✅ Valid ISO 8601 timestamps accepted
4. ✅ Invalid formats rejected with 400 error
5. ✅ Future dates rejected with 400 error
6. ✅ Past dates accepted (backdating works)
7. ✅ `updated_at` remains independent (always current time)
8. ✅ Weekly summaries can be created with KW-appropriate dates
9. ✅ KW queries return memories by their backdated `created_at`
10. ✅ Backwards compatible (existing API clients unaffected)

## Files to Modify

1. `worker/src/index.ts` - Interface, validation, INSERT logic
2. `specs/openapi.yaml` - API specification
3. `CHANGELOG.md` - Feature documentation
4. `README.md` - Usage examples

## Estimated Complexity

**Low-Medium** - Simple additive feature with straightforward validation.

**Risk:** Very Low - Optional parameter, defaults to existing behavior, no breaking changes.

## Example Migration Script

After implementing this feature, update weekly summaries with:

```bash
# Delete old memories
curl -X DELETE /api/forget/bac6efc8-2423-4df6-aa8d-74e44779dea3

# Create with correct timestamp
curl -X POST /api/remember \
  -d '{
    "content": "KW 49 (2024-12-02 bis 2024-12-08): Projektstart...",
    "type": "Context",
    "tags": ["weekly-summary", "kw49-2024"],
    "created_at": "2024-12-05T12:00:00Z"
  }'
```

Or use the MCP tool after API update:
```typescript
await shodh_cloudflare.forget({ id: "old-id" });
await shodh_cloudflare.remember({
  content: "KW 49 summary...",
  type: "Context",
  tags: ["weekly-summary"],
  created_at: "2024-12-05T12:00:00Z"
});
```
