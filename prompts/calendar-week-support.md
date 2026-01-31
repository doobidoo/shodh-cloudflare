# Calendar Week (KW) Support for Temporal Query Parser

## Objective

Extend the `parseTemporalExpression()` function to support calendar week (KW) queries in both German and English, enabling date range queries like "KW 49", "week 3", "CW 52 2024", etc.

## Current State

**File:** `worker/src/index.ts`

**Current Implementation:**
- `parseTemporalExpression()` function (lines 154-348) supports 51 temporal patterns
- Supported: relative expressions (last week, vor 2 wochen), weekday references, ISO dates
- **NOT supported:** Calendar week numbers (KW 1, week 52, CW 3 2024)

**Limitation:** Users cannot query by calendar week number, which is a common use case in German-speaking business contexts.

## Requirements

### 1. Calendar Week Patterns to Support

**German:**
- `KW 49` → Week 49 of current year
- `KW49` → Week 49 of current year (no space)
- `KW 1 2024` → Week 1 of 2024
- `KW1 2024` → Week 1 of 2024
- `Kalenderwoche 49` → Week 49 of current year
- `Kalenderwoche 3 2025` → Week 3 of 2025

**English:**
- `week 52` → Week 52 of current year
- `week52` → Week 52 of current year
- `week 1 2024` → Week 1 of 2024
- `week1 2024` → Week 1 of 2024
- `CW 49` → Calendar Week 49 of current year (international abbrev)
- `CW49` → Calendar Week 49 of current year
- `CW 3 2025` → Calendar Week 3 of 2025

**Total:** 14 new patterns (7 German, 7 English)

### 2. ISO 8601 Week Date Standard

Calendar weeks should follow **ISO 8601** standard:
- Week starts on Monday
- Week 1 is the first week with a Thursday in the new year
- Weeks are numbered 1-53 (most years have 52, some have 53)

**JavaScript Implementation:**
```typescript
// Helper to get ISO week number from a date
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const jan4 = new Date(target.getFullYear(), 0, 4);
  const dayDiff = (target.valueOf() - jan4.valueOf()) / 86400000;
  return 1 + Math.floor(dayDiff / 7);
}

// Helper to get Monday of ISO week N in year Y
function getMondayOfWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // Monday=0
  const week1Monday = new Date(year, 0, 4 - jan4DayOfWeek);
  const targetMonday = new Date(week1Monday);
  targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7);
  return getStartOfDay(targetMonday);
}

// Helper to get Sunday (last day) of ISO week N in year Y
function getSundayOfWeek(year: number, week: number): Date {
  const monday = getMondayOfWeek(year, week);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  // Set to end of day (23:59:59.999)
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}
```

### 3. Return Value Convention

**IMPORTANT:** Calendar week queries should return **BOTH** start and end dates:

**Option A: Return object (BREAKING CHANGE)**
```typescript
function parseTemporalExpression(expr: string): string | { from: string, to: string } | null {
  // For calendar weeks, return range object
  if (isCalendarWeekExpression) {
    return {
      from: mondayISO,
      to: sundayISO
    };
  }
  // For other expressions, return single date string
  return isoDate;
}
```

**Option B: Return tuple string (BACKWARDS COMPATIBLE - RECOMMENDED)**
```typescript
function parseTemporalExpression(expr: string): string | null {
  // For calendar weeks, return "START_ISO|END_ISO" (pipe-separated)
  if (isCalendarWeekExpression) {
    return `${mondayISO}|${sundayISO}`;
  }
  // For other expressions, return single date string
  return isoDate;
}
```

**Recommendation:** Use **Option B** (tuple string) for backwards compatibility.

Update `/api/recall` endpoint to handle tuple format:

```typescript
const lowerBoundExpr = body.from || body.since;
const upperBoundExpr = body.to || body.until || body.before;

// Parse temporal expressions
let sinceDate = lowerBoundExpr ? parseTemporalExpression(lowerBoundExpr) : null;
let beforeDate = upperBoundExpr ? parseTemporalExpression(upperBoundExpr) : null;

// Handle calendar week tuples (format: "START|END")
if (sinceDate && sinceDate.includes('|')) {
  const [start, end] = sinceDate.split('|');
  sinceDate = start;
  // If no explicit upper bound, use week end
  if (!beforeDate) {
    beforeDate = end;
  }
}

if (beforeDate && beforeDate.includes('|')) {
  const [start, end] = beforeDate.split('|');
  beforeDate = end;
  // If no explicit lower bound, use week start
  if (!sinceDate) {
    sinceDate = start;
  }
}
```

### 4. Parsing Implementation

Add to `parseTemporalExpression()` function (after existing patterns, before ISO date fallback):

```typescript
// Calendar Week patterns (ISO 8601)
// German: "KW 49", "KW49", "KW 1 2024", "Kalenderwoche 3"
let match = lowerSince.match(/^(?:kw|kalenderwoche)\s*(\d{1,2})(?:\s+(\d{4}))?$/i);
if (match) {
  const weekNum = parseInt(match[1]);
  const year = match[2] ? parseInt(match[2]) : now.getFullYear();

  // Validate week number (1-53)
  if (weekNum < 1 || weekNum > 53) {
    return null; // Invalid week number
  }

  const monday = getMondayOfWeek(year, weekNum);
  const sunday = getSundayOfWeek(year, weekNum);

  // Return range as pipe-separated tuple
  return `${monday.toISOString()}|${sunday.toISOString()}`;
}

// English: "week 52", "week52", "week 1 2024", "CW 49"
match = lowerSince.match(/^(?:week|cw)\s*(\d{1,2})(?:\s+(\d{4}))?$/i);
if (match) {
  const weekNum = parseInt(match[1]);
  const year = match[2] ? parseInt(match[2]) : now.getFullYear();

  // Validate week number (1-53)
  if (weekNum < 1 || weekNum > 53) {
    return null; // Invalid week number
  }

  const monday = getMondayOfWeek(year, weekNum);
  const sunday = getSundayOfWeek(year, weekNum);

  // Return range as pipe-separated tuple
  return `${monday.toISOString()}|${sunday.toISOString()}`;
}
```

### 5. Examples

**Query Examples:**

```bash
# German KW queries
curl -X POST https://shodh-api.henry-krupp.workers.dev/api/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "summary", "from": "KW 49"}'

curl -X POST https://shodh-api.henry-krupp.workers.dev/api/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "summary", "from": "KW 1 2024", "to": "KW 5 2024"}'

curl -X POST https://shodh-api.henry-krupp.workers.dev/api/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "summary", "since": "Kalenderwoche 49"}'

# English week queries
curl -X POST https://shodh-api.henry-krupp.workers.dev/api/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "updates", "from": "week 1", "to": "week 5"}'

curl -X POST https://shodh-api.henry-krupp.workers.dev/api/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "fixes", "since": "CW 52 2024"}'

# Mixed (KW start, natural language end)
curl -X POST https://shodh-api.henry-krupp.workers.dev/api/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "work", "from": "KW 1", "to": "yesterday"}'
```

**Expected Behavior:**
- `"from": "KW 49"` → Memories from Monday of week 49 to now
- `"from": "KW 1 2024", "to": "KW 5 2024"` → Memories from week 1 to week 5 (2024)
- `"since": "Kalenderwoche 49"` → Same as "from: KW 49"
- `"from": "week 1", "to": "week 5"` → English equivalent
- `"from": "KW 1", "to": "yesterday"` → Mixed temporal expressions work

### 6. Testing Requirements

**Unit Tests** (add to existing test suite or create new test file):

```typescript
// Test ISO week calculation
const testDate1 = new Date('2024-12-30'); // Monday of week 1 2025
console.assert(getISOWeek(testDate1) === 1);

const testDate2 = new Date('2024-12-02'); // Monday of week 49 2024
console.assert(getISOWeek(testDate2) === 49);

// Test Monday calculation
const monday49 = getMondayOfWeek(2024, 49);
console.assert(monday49.getDate() === 2 && monday49.getMonth() === 11); // Dec 2

const monday1_2025 = getMondayOfWeek(2025, 1);
console.assert(monday1_2025.getDate() === 30 && monday1_2025.getMonth() === 11); // Dec 30 2024

// Test parsing
console.assert(parseTemporalExpression('KW 49') !== null);
console.assert(parseTemporalExpression('KW49') !== null);
console.assert(parseTemporalExpression('KW 1 2024') !== null);
console.assert(parseTemporalExpression('Kalenderwoche 3') !== null);
console.assert(parseTemporalExpression('week 52') !== null);
console.assert(parseTemporalExpression('CW 5 2025') !== null);

// Test invalid inputs
console.assert(parseTemporalExpression('KW 0') === null); // Week 0 invalid
console.assert(parseTemporalExpression('KW 54') === null); // Week 54 invalid
console.assert(parseTemporalExpression('KW') === null); // Missing number
```

**Manual Tests:**

```bash
# Test 1: Current year KW (German)
curl -X POST ... -d '{"query": "summary", "from": "KW 49"}'
# Expected: Memories from Mon Dec 2, 2024 onwards

# Test 2: Specific year KW range (German)
curl -X POST ... -d '{"query": "summary", "from": "KW 1 2024", "to": "KW 5 2024"}'
# Expected: Memories from Mon Jan 1, 2024 to Sun Feb 4, 2024

# Test 3: English week
curl -X POST ... -d '{"query": "updates", "from": "week 1"}'
# Expected: Same as KW 1 (current year)

# Test 4: Kalenderwoche (full German word)
curl -X POST ... -d '{"query": "notes", "since": "Kalenderwoche 50"}'
# Expected: Memories from Mon Dec 9, 2024 onwards

# Test 5: Mixed with weekly-summary memories
curl -X POST ... -d '{"query": "weekly-summary", "from": "KW 49 2024", "to": "KW 5 2026"}'
# Expected: All 9 weekly summary memories created earlier

# Test 6: Invalid week number
curl -X POST ... -d '{"query": "test", "from": "KW 0"}'
# Expected: 400 Bad Request or ignore KW filter (falls back to no date filter)
```

### 7. Edge Cases

**Validation:**
- Week numbers must be 1-53 (reject 0, 54+)
- Year must be 4 digits if provided (reject 2-digit years for clarity)
- Space between "KW" and number is optional ("KW 49" = "KW49")
- Case insensitive (kw = KW = Kw)

**Year Boundary Cases:**
- Week 1 of 2025 starts on Dec 30, 2024 (Monday) → getMondayOfWeek(2025, 1) should return 2024-12-30
- Week 52 of 2024 starts on Dec 23, 2024 → getMondayOfWeek(2024, 52) should return 2024-12-23
- Some years have 53 weeks (e.g., 2020, 2026) → validate against actual year

**Mixed Queries:**
- `"from": "KW 1", "to": "last week"` → Should work (KW gives range, last week gives single date)
- `"from": "yesterday", "to": "KW 5"` → Should work (uses end of week 5)

**Error Handling:**
- If parseTemporalExpression returns null for invalid KW, the filter should be ignored (not fail the entire request)
- Log warning for invalid week numbers: `console.warn('Invalid week number:', weekNum)`

### 8. Response Format

When a calendar week is parsed, include parsed range in response:

```json
{
  "memories": [...],
  "count": 10,
  "query": "summary",
  "from": "KW 49",
  "since_parsed": "2024-12-02T00:00:00.000Z",
  "before_parsed": "2024-12-08T23:59:59.999Z",
  "kw_range": "KW 49/2024 (Dec 2 - Dec 8)"
}
```

Optional: Add `kw_range` field to response when calendar week is detected.

### 9. Documentation Updates

**Files to update:**

1. **CHANGELOG.md** - Add to Unreleased section:
   ```markdown
   - **Calendar Week (KW) Support**: Extended temporal query parser with calendar week patterns
     - German: `KW 49`, `KW49`, `KW 1 2024`, `Kalenderwoche 3`
     - English: `week 52`, `week52`, `week 1 2024`, `CW 49`
     - ISO 8601 standard (week starts Monday, week 1 has first Thursday)
     - Week range queries: `from: "KW 1 2024", to: "KW 5 2024"`
     - Mixed queries: `from: "KW 1", to: "yesterday"`
     - 14 new patterns (7 German, 7 English)
     - Total: 65 temporal patterns (51 existing + 14 new)
   ```

2. **TEMPORAL_PARSER_IMPLEMENTATION.md** - Update pattern count:
   ```markdown
   ## Features Implemented

   ✅ **7. Calendar Week References** (NEW)
   - German: `KW 49`, `KW 1 2024`, `Kalenderwoche 3`
   - English: `week 52`, `week 1 2024`, `CW 49`
   - ISO 8601 standard (Monday start, week 1 = first Thursday)

   **Total: 65 tested patterns** (51 existing + 14 new)
   ```

3. **README.md** - Add examples to API documentation:
   ```markdown
   ### Calendar Week Queries

   Query by calendar week (ISO 8601):

   ```bash
   # German KW
   curl -X POST /api/recall \
     -d '{"query": "updates", "from": "KW 49"}'

   # English week
   curl -X POST /api/recall \
     -d '{"query": "fixes", "from": "week 1 2024", "to": "week 5 2024"}'
   ```
   ```

4. **specs/openapi.yaml** - Add examples:
   ```yaml
   examples:
     calendar_week_german:
       summary: German calendar week query
       value:
         query: "projekt updates"
         from: "KW 49"
         to: "KW 5"
     calendar_week_english:
       summary: English week query
       value:
         query: "bug fixes"
         from: "week 1 2024"
         to: "week 5 2024"
   ```

## Implementation Checklist

- [ ] Add ISO 8601 helper functions (getISOWeek, getMondayOfWeek, getSundayOfWeek)
- [ ] Add German KW pattern parsing (7 variants)
- [ ] Add English week pattern parsing (7 variants)
- [ ] Implement tuple return format ("START_ISO|END_ISO")
- [ ] Update /api/recall endpoint to handle tuple format
- [ ] Add week number validation (1-53)
- [ ] Add unit tests for ISO week calculation
- [ ] Add unit tests for pattern parsing
- [ ] Test with weekly-summary memories (KW 49-KW 5)
- [ ] Update CHANGELOG.md
- [ ] Update TEMPORAL_PARSER_IMPLEMENTATION.md
- [ ] Update README.md with examples
- [ ] Update OpenAPI spec with KW examples
- [ ] Deploy to Cloudflare Workers
- [ ] Create git commit with detailed message

## Success Criteria

1. ✅ German KW patterns work (KW 49, KW49, KW 1 2024, Kalenderwoche 3)
2. ✅ English week patterns work (week 52, week52, week 1 2024, CW 49)
3. ✅ ISO 8601 compliance (Monday start, correct week 1 calculation)
4. ✅ Range queries with KW work ("KW 1" to "KW 5")
5. ✅ Mixed queries work ("KW 1" to "yesterday")
6. ✅ Invalid week numbers (0, 54) are rejected or ignored gracefully
7. ✅ Year boundary weeks work correctly (week 1 2025 starts Dec 30 2024)
8. ✅ Weekly-summary memories can be queried by KW
9. ✅ Backwards compatible (existing 51 patterns still work)
10. ✅ Documentation updated with KW examples

## Files to Modify

1. `worker/src/index.ts` - Add ISO helpers, KW parsing, tuple handling
2. `CHANGELOG.md` - Feature documentation
3. `TEMPORAL_PARSER_IMPLEMENTATION.md` - Pattern count update
4. `README.md` - Usage examples
5. `specs/openapi.yaml` - API examples

## Estimated Complexity

**Medium-High** - Requires ISO 8601 week calculation logic, tuple format handling, and thorough edge case testing.

**Risk:** Low-Medium - Additive feature, backwards compatible, but ISO week calculation has year boundary complexity.

## Reference

- **ISO 8601 Week Date**: https://en.wikipedia.org/wiki/ISO_week_date
- **German KW usage**: Common in German-speaking business contexts (Austria, Germany, Switzerland)
- **Existing implementation**: `parseTemporalExpression()` in worker/src/index.ts:154-348

## Example Use Case

User has created weekly summary memories (KW 49 2024 to KW 5 2026) and wants to query:

```bash
# Get all December 2024 weekly summaries
curl -X POST /api/recall \
  -d '{"query": "weekly-summary", "from": "KW 49 2024", "to": "KW 52 2024"}'

# Get January 2026 weekly summaries
curl -X POST /api/recall \
  -d '{"query": "weekly-summary", "from": "KW 1 2026", "to": "KW 5 2026"}'

# Get Q1 2024 summaries
curl -X POST /api/recall \
  -d '{"query": "weekly-summary", "from": "week 1 2024", "to": "week 13 2024"}'
```

This makes the temporal query system highly practical for German-speaking business users who think in calendar weeks.
