# Temporal Query Parser Enhancement - Implementation Complete

## Summary

Enhanced the `parseSinceDate()` function in `worker/src/index.ts` to support comprehensive natural language temporal expressions, matching the functionality of SecondBrain's iOS `TemporalQueryParser.swift`.

## Implementation Details

### File Modified
- `worker/src/index.ts` (lines 148-340): `parseSinceDate()` function

### Features Implemented

✅ **1. Basic Temporal Keywords** (already existed, preserved)
- `today`, `heute`
- `yesterday`, `gestern`
- `this week`, `diese woche`

✅ **2. Extended Fixed Patterns** (NEW)
- `last week`, `letzte woche`, `vergangene woche`
- `this month`, `diesen monat`, `diesem monat`
- `last month`, `letzten monat`, `vergangenen monat`
- `this year`, `dieses jahr`
- `last year`, `letztes jahr`

✅ **3. Flexible N-Unit Patterns** (NEW)
- `last N days`, `past N days`, `letzten N Tage`
- `last N weeks`, `past N weeks`, `letzten N Wochen`
- `last N months`, `past N months`, `letzten N Monate`
- `N days ago`, `vor N Tagen`
- `N weeks ago`, `vor N Wochen`
- `N months ago`, `vor N Monaten`

✅ **4. Weekday References** (NEW)
- Direct weekday names: `monday`, `montag`, `tuesday`, `dienstag`, etc.
  - Returns most recent occurrence (or previous week if today is that day)
- `last monday`, `letzten montag` (previous week's occurrence)

✅ **5. Since/Seit Expressions** (NEW)
- `seit gestern`, `since yesterday`
- `seit montag`, `since monday`
- `seit letzter woche`, `since last week`
- `seit diesem monat`, `since this month`

✅ **6. Legacy Support** (preserved)
- `7d`, `30d`, `90d` format
- ISO date strings

## Testing

All 51 patterns tested and passing:
- 6/6 basic temporal keywords
- 13/13 extended fixed patterns
- 15/15 flexible N-unit patterns
- 6/6 weekday references
- 8/8 seit/since expressions
- 3/3 legacy formats

## Implementation Notes

- **Pure function**: No side effects, uses `new Date()` for current time
- **Returns ISO strings**: All dates returned as UTC ISO format (start of day/period)
- **Language support**: English and German variations supported
- **Edge case handling**: 
  - "last monday" when today is Monday correctly returns previous week's Monday
  - Month/year boundaries handled correctly
  - Regex patterns use non-capturing groups to handle multiple format variants

## Documentation Updated

- `CHANGELOG.md` - Added comprehensive feature description in Unreleased section
- `prompts/temporal-query-parser-enhancement.md` - Original specification preserved for reference

## No Breaking Changes

- All existing patterns continue to work
- Function signature unchanged
- Return type unchanged
