# Temporal Parser Testing

This document describes the comprehensive test coverage for the temporal expression parser (65 patterns).

## Test Infrastructure

**Framework:** Vitest 1.2.0
**Coverage Target:** 100% of temporal-parser.ts
**Test File:** `src/temporal-parser.test.ts`

### Installation

```bash
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# With coverage
npm test:coverage

# UI dashboard
npm test:ui
```

## Test Categories

### Category 1: Basic Keywords (6 tests)
- `today` / `heute` → start of current day
- `yesterday` / `gestern` → start of previous day
- `this week` / `diese woche` → Monday of current week

### Category 2: Extended Fixed Patterns (13 tests)
- `last week` / `letzte woche` / `vergangene woche`
- `this month` / `diesen monat` / `diesem monat`
- `last month` / `letzten monat` / `vergangenen monat`
- `this year` / `dieses jahr`
- `last year` / `letztes jahr`

### Category 3: Flexible N-Unit Patterns (15 tests)
**Days (5):**
- `last N days`, `past N days`, `letzten N Tage`
- `N days ago`, `vor N Tagen`

**Weeks (5):**
- `last N weeks`, `past N weeks`, `letzten N Wochen`
- `N weeks ago`, `vor N Wochen`

**Months (5):**
- `last N months`, `past N months`, `letzten N Monate`
- `N months ago`, `vor N Monaten`

### Category 4: Weekday References (6 tests)
- `monday` / `montag` → most recent Monday
- `friday` / `freitag` → most recent Friday
- `last monday` / `letzten montag` → previous week's Monday

### Category 5: Seit/Since Expressions (8 tests)
- `seit gestern` / `since yesterday`
- `seit montag` / `since monday`
- `seit letzter woche` / `since last week`
- `seit diesem monat` / `since this month`

### Category 6: Legacy Formats (3 tests)
- `7d` → 7 days ago
- `30d` → 30 days ago
- `2024-12-05T12:00:00Z` → ISO passthrough

### Category 7: Calendar Week Patterns (14 tests)
**German KW (6):**
- `KW 5` / `KW5` → Week 5 of current year
- `KW 1 2024` / `KW1 2024` → Week 1 of 2024
- `Kalenderwoche 5` / `Kalenderwoche 1 2024`

**English Week (6):**
- `week 5` / `week5` → Week 5 of current year
- `week 1 2024` / `week1 2024` → Week 1 of 2024
- `CW 5` / `CW 1 2024` → Calendar Week notation

**Year Boundaries (2):**
- `KW 1 2025` → Monday Dec 30, 2024 to Sunday Jan 5, 2025
- `week 52 2024` → Monday Dec 23 to Sunday Dec 29, 2024

### Category 8: Invalid Input Handling (5 tests)
- `KW 0` → null (invalid week)
- `KW 54` → null (invalid week)
- `this is not a date` → null
- Case insensitivity: `TODAY` = `today`
- ISO date pass-through: `2024-12-05T12:00:00Z`

## Test Date Reference

All tests use: **Saturday, January 31, 2026 @ 12:00 UTC**

This date is strategically chosen to test:
- Weekend date handling
- Month boundaries (January)
- Year beginning (January)
- Weekday calculations (Saturday)

## Example Test Output

```
✓ src/temporal-parser.test.ts (71 tests) 123ms
  ✓ Temporal Parser (71)
    ✓ Basic Keywords (6)
    ✓ Extended Fixed Patterns (13)
    ✓ Flexible N-Unit Patterns (15)
      ✓ Days (5)
      ✓ Weeks (5)
      ✓ Months (5)
    ✓ Weekday References (6)
    ✓ Seit/Since Expressions (8)
    ✓ Legacy Formats (3)
    ✓ Calendar Week Patterns (14)
      ✓ German KW (6)
      ✓ English Week (6)
      ✓ Year Boundary Cases (2)
    ✓ Invalid Input Handling (5)
    ✓ Defaults to current date when no options provided (1)

Test Files  1 passed (1)
     Tests  71 passed (71)
  Start at  12:00:00
  Duration  123ms
```

## Coverage Goals

```
% Coverage report from v8
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |     100 |      100 |     100 |     100 |
 temporal-parser.ts |     100 |      100 |     100 |     100 |
--------------------|---------|----------|---------|---------|
```

## Key Testing Patterns

### 1. Testable Design
The `parseTemporalExpression()` function is extracted to a separate module with optional `now` parameter:

```typescript
export function parseTemporalExpression(
  expr: string,
  options: TemporalParserOptions = {}
): string | null {
  const now = options.now || new Date();
  // ...
}
```

This enables deterministic testing with fixed dates.

### 2. Test Data Structure
Using `it.each()` for pattern groups minimizes repetition:

```typescript
it.each([
  ['today', '2026-01-31T00:00:00.000Z'],
  ['heute', '2026-01-31T00:00:00.000Z'],
  // ...
])('should parse "%s" correctly', (input, expected) => {
  const result = parseTemporalExpression(input, { now: testDate });
  expect(result).toBe(expected);
});
```

### 3. Organized by Category
Tests are grouped by pattern type to make it easy to find and modify specific pattern tests.

## Maintenance

When adding new patterns:

1. Add pattern to `parseTemporalExpression()`
2. Add corresponding test case in appropriate category
3. Update test count in category comment
4. Run tests to verify
5. Update this document

## Known Limitations

- Tests don't cover daylight saving time transitions (all dates use UTC)
- No performance benchmarks (tests complete in <200ms)
- No fuzzing tests for edge case inputs

## CI/CD Integration

Tests run automatically on every commit via GitHub Actions (if configured).

See `.github/workflows/test.yml` for CI configuration.
