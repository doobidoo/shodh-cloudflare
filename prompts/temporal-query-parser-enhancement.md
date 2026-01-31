# Temporal Query Parser Enhancement for Shodh Cloudflare Worker

## Context

The `/api/recall` endpoint in `worker/src/index.ts` has a `since` parameter that accepts temporal expressions. Currently, `parseSinceDate()` only supports basic formats:
- "today", "heute"
- "yesterday", "gestern"
- "this week", "diese woche"
- "Xd" format (e.g., "7d" = 7 days ago)
- ISO date strings

The SecondBrain iOS app has a comprehensive `TemporalQueryParser.swift` that supports many more natural language temporal expressions. For consistency between the iOS app and Siri Shortcuts (which use the Cloudflare Worker), we need to port this functionality.

## Reference Implementation

See: `/Users/hkr/Documents/GitHub/SecondBrain/SecondBrain/UtilitiesTemporalQueryParser.swift`

## Requirements

Enhance `parseSinceDate()` in `worker/src/index.ts` to support:

### 1. Basic Temporal Keywords (already implemented)
- today / heute
- yesterday / gestern
- this week / diese woche

### 2. Extended Fixed Patterns (NEW)
- last week / letzte woche / vergangene woche
- this month / diesen monat / diesem monat
- last month / letzten monat / vergangenen monat
- this year / dieses jahr
- last year / letztes jahr

### 3. Flexible N-Unit Patterns (NEW)
Regex-based parsing for:
- "last N days" / "past N days" / "letzten N Tage"
- "last N weeks" / "past N weeks" / "letzten N Wochen"
- "last N months" / "past N months" / "letzten N Monate"
- "N days ago" / "N weeks ago" / "N months ago"
- "vor N Tagen" / "vor N Wochen" / "vor N Monaten"

### 4. Weekday References (NEW)
Map weekday names to dates:
```typescript
const weekdayNames: Record<string, number> = {
  // English (Sunday=0, Monday=1, ..., Saturday=6 in JS)
  "sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3,
  "thursday": 4, "friday": 5, "saturday": 6,
  // German
  "sonntag": 0, "montag": 1, "dienstag": 2, "mittwoch": 3,
  "donnerstag": 4, "freitag": 5, "samstag": 6
};
```

Support:
- "monday" / "montag" → most recent Monday
- "last monday" / "letzten montag" → previous week's Monday

### 5. Since/Seit Expressions (NEW)
- "seit gestern" / "since yesterday"
- "seit montag" / "since monday"
- "seit letzter woche" / "since last week"
- "seit diesem monat" / "since this month"

### 6. Time-of-Day Modifiers (OPTIONAL - lower priority)
- "this morning" / "heute morgen"
- "yesterday evening" / "gestern abend"
- "last night"

## Implementation Notes

1. The function should return an ISO date string (start of the period)
2. All comparisons in the SQL query use `>=` so we only need the start date
3. Keep the function pure (no side effects)
4. Use `new Date()` for current time
5. Handle edge cases (e.g., "last monday" when today is Monday)

## Current Function Location

```typescript
// worker/src/index.ts, around line 145
function parseSinceDate(since: string): string | null {
  // ... current implementation
}
```

## Testing

After implementation, test with:
```bash
# Basic
curl -X POST https://shodh-api.henry-krupp.workers.dev/api/recall \
  -H "Authorization: Bearer un4getable" \
  -H "Content-Type: application/json" \
  -d '{"query":"test","since":"last week","summarize":false}' | jq '.since_parsed'

# German
curl -X POST ... -d '{"query":"test","since":"letzten 3 tage"}' | jq '.since_parsed'

# Weekday
curl -X POST ... -d '{"query":"test","since":"monday"}' | jq '.since_parsed'

# N days ago
curl -X POST ... -d '{"query":"test","since":"5 days ago"}' | jq '.since_parsed'
```

## Acceptance Criteria

- [ ] All patterns from SecondBrain TemporalQueryParser are supported
- [ ] German and English expressions work
- [ ] Edge cases handled (weekday on same day, month boundaries)
- [ ] Deployed and tested via curl
- [ ] CHANGELOG.md updated
