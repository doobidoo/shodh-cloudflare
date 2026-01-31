# Temporal Range Filters Enhancement

## Objective

Extend the `/api/recall` endpoint to support flexible temporal filtering with `before`, `until`, `from`, and `to` parameters, enabling date range queries beyond the current `since`-only limitation.

## Current State

**File:** `worker/src/index.ts`

**Current Implementation:**
- `RecallRequest` interface (lines 57-67) has only `since?: string` parameter
- `parseSinceDate()` function (lines 148-343) converts natural language to ISO date
- `/api/recall` endpoint uses `since` for lower bound filtering: `WHERE created_at >= ?`

**Limitation:** Users can only filter "from date to now" but not:
- Memories before a specific date
- Memories within a specific date range (from-to)

## Requirements

### 1. Extend RecallRequest Interface

Add new optional parameters to `RecallRequest` (lines 57-67):

```typescript
interface RecallRequest {
  query: string;
  limit?: number;
  mode?: 'semantic' | 'associative' | 'hybrid';
  memory_types?: string[];
  quality_boost?: boolean;
  quality_weight?: number;
  summarize?: boolean;
  language?: string;

  // Temporal filters (all optional, support natural language + ISO dates)
  since?: string;   // Lower bound: "last week", "2024-12-01", "7d"
  before?: string;  // Upper bound: "yesterday", "2024-12-31", "3d"
  until?: string;   // Alias for 'before' (same behavior)
  from?: string;    // Alias for 'since' (same behavior)
  to?: string;      // Alias for 'before'/'until' (same behavior)
}
```

**Alias Behavior:**
- `since` = `from` (lower bound)
- `before` = `until` = `to` (upper bound)
- If both `since` and `from` provided, use `from` (explicit wins over implicit)
- If both `before`, `until`, `to` provided, use first non-null in order: `to` > `until` > `before`

### 2. Parsing Function Enhancement

**Option A: Extend `parseSinceDate()`**
Rename to `parseTemporalExpression(expr: string): string | null` - keep existing logic, works for both bounds.

**Option B: Keep separate**
Keep `parseSinceDate()` for backwards compatibility, create `parseBeforeDate()` (but they'd be identical).

**Recommendation:** Option A (rename + extend), since the parsing logic is identical for both bounds.

### 3. SQL Query Logic

Update `/api/recall` endpoint D1 query logic (currently around line 450-480):

**Current (since-only):**
```sql
WHERE created_at >= ?
```

**New (range support):**
```typescript
// Resolve aliases
const lowerBound = body.from || body.since;
const upperBound = body.to || body.until || body.before;

// Build WHERE conditions
const conditions = [];
const params = [];

if (lowerBound) {
  const sinceDate = parseTemporalExpression(lowerBound);
  if (sinceDate) {
    conditions.push('created_at >= ?');
    params.push(sinceDate);
  }
}

if (upperBound) {
  const beforeDate = parseTemporalExpression(upperBound);
  if (beforeDate) {
    conditions.push('created_at <= ?');
    params.push(beforeDate);
  }
}

const whereClause = conditions.length > 0
  ? `WHERE ${conditions.join(' AND ')}`
  : '';
```

### 4. Natural Language Patterns

All 51 existing patterns from `parseSinceDate()` should work for both `since/from` AND `before/until/to`:

**Examples:**
- `"since": "last week"` → created_at >= 2026-01-20T00:00:00Z
- `"before": "yesterday"` → created_at <= 2026-01-30T00:00:00Z
- `"from": "last month", "to": "last week"` → range query
- `"since": "2024-12-01", "until": "2024-12-31"` → December 2024
- `"from": "vor 2 wochen", "to": "gestern"` → German range

### 5. OpenAPI Specification Update

**File:** `specs/openapi.yaml`

Update `RecallRequest` schema (around line 550):

```yaml
RecallRequest:
  type: object
  required:
    - query
  properties:
    query:
      type: string
      minLength: 1
      description: Natural language search query
    # ... existing properties ...
    since:
      type: string
      nullable: true
      description: |
        Lower bound temporal filter. Supports natural language (e.g., "last week",
        "vor 2 wochen", "yesterday") and ISO dates. Alias: 'from'.
      example: "last week"
    before:
      type: string
      nullable: true
      description: |
        Upper bound temporal filter. Supports natural language (e.g., "yesterday",
        "3 days ago") and ISO dates. Aliases: 'until', 'to'.
      example: "yesterday"
    until:
      type: string
      nullable: true
      description: Alias for 'before' (upper bound)
    from:
      type: string
      nullable: true
      description: Alias for 'since' (lower bound)
    to:
      type: string
      nullable: true
      description: Alias for 'before'/'until' (upper bound)
```

Add examples to `/api/recall` endpoint:

```yaml
examples:
  time_range:
    summary: Search within date range
    value:
      query: "project updates"
      from: "last month"
      to: "last week"
      limit: 10
  before_filter:
    summary: Memories before a date
    value:
      query: "bug fixes"
      before: "2024-12-31"
      limit: 20
```

### 6. Testing Requirements

**Manual Tests** (use curl or Siri Shortcuts):

```bash
# Test 1: Only 'since' (backwards compatibility)
curl -X POST https://shodh-api.henry-krupp.workers.dev/api/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "summary", "since": "last week"}'

# Test 2: Only 'before'
curl -X POST https://shodh-api.henry-krupp.workers.dev/api/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "summary", "before": "yesterday"}'

# Test 3: Range (from-to)
curl -X POST https://shodh-api.henry-krupp.workers.dev/api/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "summary", "from": "last month", "to": "last week"}'

# Test 4: Range (since-until)
curl -X POST https://shodh-api.henry-krupp.workers.dev/api/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "summary", "since": "2024-12-01", "until": "2024-12-31"}'

# Test 5: German range
curl -X POST https://shodh-api.henry-krupp.workers.dev/api/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "summary", "from": "letzten monat", "to": "gestern"}'
```

**Expected Results:**
- Test 1: Memories from last Monday onwards
- Test 2: Memories up to yesterday (inclusive)
- Test 3: Memories from first of last month to last Monday
- Test 4: All December 2024 memories
- Test 5: German range works identically to English

### 7. Edge Cases

**Validation:**
- If `lowerBound > upperBound`, return 400 Bad Request with error message
- If both `since` and `from` provided, prefer `from` (explicit alias)
- If multiple upper bound aliases provided, use first in precedence: `to` > `until` > `before`
- Invalid date expressions should be ignored (not fail the entire request)

**Example Error Response:**
```json
{
  "error": "Invalid date range: 'from' (2026-01-30) is after 'to' (2026-01-20)"
}
```

### 8. Documentation Updates

**Files to update:**
1. `CHANGELOG.md` - Add to Unreleased section:
   ```markdown
   - **Temporal Range Filters**: Extended `/api/recall` endpoint with `before`/`until`/`to` parameters
     - `before`/`until`/`to`: Upper bound filter (memories before/up to a date)
     - `from`: Alias for `since` (lower bound)
     - `to`: Alias for `before`/`until` (upper bound)
     - Range queries: `from` + `to` for date ranges (e.g., "last month" to "last week")
     - All 51 natural language patterns supported for both bounds
     - Backwards compatible: `since` parameter unchanged
   ```

2. `README.md` - Add examples to API documentation section

3. Create `TEMPORAL_RANGE_FILTERS_IMPLEMENTATION.md` with implementation details (similar to TEMPORAL_PARSER_IMPLEMENTATION.md)

## Implementation Checklist

- [ ] Extend `RecallRequest` interface with 5 new optional parameters
- [ ] Rename `parseSinceDate()` to `parseTemporalExpression()` (or keep both for clarity)
- [ ] Update `/api/recall` SQL query logic with range support
- [ ] Add alias resolution logic (from→since, to→until→before)
- [ ] Add date range validation (lower < upper)
- [ ] Update OpenAPI spec with new parameters and examples
- [ ] Update CHANGELOG.md
- [ ] Create implementation documentation
- [ ] Test all 5 curl examples
- [ ] Test with weekly-summary memories created earlier (KW 49-KW 5)
- [ ] Deploy to Cloudflare Workers
- [ ] Create git commit with detailed message

## Success Criteria

1. ✅ All existing `since` queries work unchanged (backwards compatibility)
2. ✅ `before`/`until`/`to` filters work with all 51 natural language patterns
3. ✅ Range queries (`from` + `to`) return correct subset of memories
4. ✅ Invalid ranges return 400 error with clear message
5. ✅ German and English patterns work for all parameters
6. ✅ OpenAPI spec reflects new functionality
7. ✅ No breaking changes to existing API consumers

## Files to Modify

1. `worker/src/index.ts` - Interface, parsing, SQL logic
2. `specs/openapi.yaml` - API specification
3. `CHANGELOG.md` - Feature documentation
4. `TEMPORAL_RANGE_FILTERS_IMPLEMENTATION.md` - New file

## Estimated Complexity

**Medium** - Extends existing well-tested temporal parser, mostly SQL query logic changes.

**Risk:** Low - Additive feature, no breaking changes, aliases provide UX flexibility.
