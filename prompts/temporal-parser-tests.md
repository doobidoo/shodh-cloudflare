# Comprehensive Temporal Parser Tests

## Objective

Create automated tests for all 65 temporal patterns to ensure reliable parsing and date calculation across all supported natural language expressions (English & German).

## Current State

**Implementation:**
- `worker/src/index.ts` - `parseTemporalExpression()` function (lines 154-348)
- 65 temporal patterns implemented (51 base + 14 KW patterns)
- No automated tests exist

**Problem:** Changes to the parser could break patterns without detection. We need comprehensive test coverage.

## Requirements

### 1. Test Framework

**Option A: Vitest (Recommended)**
- Modern, fast, Vite-native
- ESM support out of the box
- Compatible with TypeScript
- Snapshot testing support

**Option B: Jest**
- More mature, larger ecosystem
- Requires additional ESM config

**Recommendation:** Use Vitest for modern TypeScript testing.

### 2. Test File Structure

Create `worker/src/temporal-parser.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseTemporalExpression } from './index';

describe('Temporal Parser - Basic Keywords', () => {
  beforeEach(() => {
    // Mock current date for deterministic tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));
  });

  it('should parse "today" to start of current day', () => {
    const result = parseTemporalExpression('today');
    expect(result).toBe('2026-01-31T00:00:00.000Z');
  });

  it('should parse "heute" to start of current day', () => {
    const result = parseTemporalExpression('heute');
    expect(result).toBe('2026-01-31T00:00:00.000Z');
  });

  // ... more tests
});
```

### 3. Test Categories (Match Pattern Groups)

#### Category 1: Basic Keywords (6 tests)
```typescript
describe('Basic Keywords', () => {
  const testDate = new Date('2026-01-31T12:00:00Z'); // Friday

  it.each([
    ['today', '2026-01-31T00:00:00.000Z'],
    ['heute', '2026-01-31T00:00:00.000Z'],
    ['yesterday', '2026-01-30T00:00:00.000Z'],
    ['gestern', '2026-01-30T00:00:00.000Z'],
    ['this week', '2026-01-26T00:00:00.000Z'], // Monday
    ['diese woche', '2026-01-26T00:00:00.000Z'],
  ])('should parse "%s" correctly', (input, expected) => {
    const result = parseTemporalExpression(input);
    expect(result).toBe(expected);
  });
});
```

#### Category 2: Extended Fixed Patterns (13 tests)
```typescript
describe('Extended Fixed Patterns', () => {
  const testDate = new Date('2026-01-31T12:00:00Z');

  it.each([
    ['last week', '2026-01-19T00:00:00.000Z'], // Previous Monday
    ['letzte woche', '2026-01-19T00:00:00.000Z'],
    ['vergangene woche', '2026-01-19T00:00:00.000Z'],
    ['this month', '2026-01-01T00:00:00.000Z'],
    ['diesen monat', '2026-01-01T00:00:00.000Z'],
    ['diesem monat', '2026-01-01T00:00:00.000Z'],
    ['last month', '2025-12-01T00:00:00.000Z'],
    ['letzten monat', '2025-12-01T00:00:00.000Z'],
    ['vergangenen monat', '2025-12-01T00:00:00.000Z'],
    ['this year', '2026-01-01T00:00:00.000Z'],
    ['dieses jahr', '2026-01-01T00:00:00.000Z'],
    ['last year', '2025-01-01T00:00:00.000Z'],
    ['letztes jahr', '2025-01-01T00:00:00.000Z'],
  ])('should parse "%s" correctly', (input, expected) => {
    const result = parseTemporalExpression(input);
    expect(result).toBe(expected);
  });
});
```

#### Category 3: Flexible N-Unit Patterns (15 tests)
```typescript
describe('Flexible N-Unit Patterns', () => {
  const testDate = new Date('2026-01-31T12:00:00Z');

  describe('Days', () => {
    it.each([
      ['last 3 days', '2026-01-28T00:00:00.000Z'],
      ['past 7 days', '2026-01-24T00:00:00.000Z'],
      ['letzten 5 Tage', '2026-01-26T00:00:00.000Z'],
      ['3 days ago', '2026-01-28T00:00:00.000Z'],
      ['vor 2 Tagen', '2026-01-29T00:00:00.000Z'],
    ])('should parse "%s" correctly', (input, expected) => {
      const result = parseTemporalExpression(input);
      expect(result).toBe(expected);
    });
  });

  describe('Weeks', () => {
    it.each([
      ['last 2 weeks', '2026-01-17T00:00:00.000Z'],
      ['past 3 weeks', '2026-01-10T00:00:00.000Z'],
      ['letzten 4 Wochen', '2026-01-03T00:00:00.000Z'],
      ['2 weeks ago', '2026-01-17T00:00:00.000Z'],
      ['vor 1 Woche', '2026-01-24T00:00:00.000Z'],
    ])('should parse "%s" correctly', (input, expected) => {
      const result = parseTemporalExpression(input);
      expect(result).toBe(expected);
    });
  });

  describe('Months', () => {
    it.each([
      ['last 2 months', '2025-11-01T00:00:00.000Z'],
      ['past 3 months', '2025-10-01T00:00:00.000Z'],
      ['letzten 6 Monate', '2025-07-01T00:00:00.000Z'],
      ['2 months ago', '2025-11-01T00:00:00.000Z'],
      ['vor 1 Monat', '2025-12-01T00:00:00.000Z'],
    ])('should parse "%s" correctly', (input, expected) => {
      const result = parseTemporalExpression(input);
      expect(result).toBe(expected);
    });
  });
});
```

#### Category 4: Weekday References (6 tests)
```typescript
describe('Weekday References', () => {
  const testDate = new Date('2026-01-31T12:00:00Z'); // Saturday

  describe('Most Recent Weekday', () => {
    it.each([
      ['monday', '2026-01-26T00:00:00.000Z'], // Last Monday
      ['montag', '2026-01-26T00:00:00.000Z'],
      ['friday', '2026-01-30T00:00:00.000Z'], // Yesterday (Friday)
      ['freitag', '2026-01-30T00:00:00.000Z'],
    ])('should parse "%s" to most recent occurrence', (input, expected) => {
      const result = parseTemporalExpression(input);
      expect(result).toBe(expected);
    });
  });

  describe('Last [Weekday]', () => {
    it.each([
      ['last monday', '2026-01-26T00:00:00.000Z'], // Previous week's Monday
      ['letzten montag', '2026-01-26T00:00:00.000Z'],
    ])('should parse "%s" to previous week', (input, expected) => {
      const result = parseTemporalExpression(input);
      expect(result).toBe(expected);
    });
  });
});
```

#### Category 5: Seit/Since Expressions (8 tests)
```typescript
describe('Seit/Since Expressions', () => {
  const testDate = new Date('2026-01-31T12:00:00Z');

  it.each([
    ['seit gestern', '2026-01-30T00:00:00.000Z'],
    ['since yesterday', '2026-01-30T00:00:00.000Z'],
    ['seit montag', '2026-01-26T00:00:00.000Z'],
    ['since monday', '2026-01-26T00:00:00.000Z'],
    ['seit letzter woche', '2026-01-19T00:00:00.000Z'],
    ['since last week', '2026-01-19T00:00:00.000Z'],
    ['seit diesem monat', '2026-01-01T00:00:00.000Z'],
    ['since this month', '2026-01-01T00:00:00.000Z'],
  ])('should parse "%s" correctly', (input, expected) => {
    const result = parseTemporalExpression(input);
    expect(result).toBe(expected);
  });
});
```

#### Category 6: Legacy Formats (3 tests)
```typescript
describe('Legacy Formats', () => {
  const testDate = new Date('2026-01-31T12:00:00Z');

  it.each([
    ['7d', '2026-01-24T00:00:00.000Z'],
    ['30d', '2026-01-01T00:00:00.000Z'],
    ['2024-12-05T12:00:00Z', '2024-12-05T12:00:00.000Z'], // ISO passthrough
  ])('should parse "%s" correctly', (input, expected) => {
    const result = parseTemporalExpression(input);
    expect(result).toBe(expected);
  });
});
```

#### Category 7: Calendar Week Patterns (14 tests)
```typescript
describe('Calendar Week Patterns (ISO 8601)', () => {
  const testDate = new Date('2026-01-31T12:00:00Z');

  describe('German KW', () => {
    it.each([
      ['KW 5', '2026-01-26T00:00:00.000Z|2026-02-01T23:59:59.999Z'],
      ['KW5', '2026-01-26T00:00:00.000Z|2026-02-01T23:59:59.999Z'],
      ['KW 1 2024', '2024-01-01T00:00:00.000Z|2024-01-07T23:59:59.999Z'],
      ['KW1 2024', '2024-01-01T00:00:00.000Z|2024-01-07T23:59:59.999Z'],
      ['Kalenderwoche 49', '2025-12-01T00:00:00.000Z|2025-12-07T23:59:59.999Z'],
      ['Kalenderwoche 3 2025', '2025-01-13T00:00:00.000Z|2025-01-19T23:59:59.999Z'],
    ])('should parse "%s" to ISO week range', (input, expected) => {
      const result = parseTemporalExpression(input);
      expect(result).toBe(expected);
    });
  });

  describe('English Week', () => {
    it.each([
      ['week 52', '2025-12-22T00:00:00.000Z|2025-12-28T23:59:59.999Z'],
      ['week52', '2025-12-22T00:00:00.000Z|2025-12-28T23:59:59.999Z'],
      ['week 1 2024', '2024-01-01T00:00:00.000Z|2024-01-07T23:59:59.999Z'],
      ['week1 2024', '2024-01-01T00:00:00.000Z|2024-01-07T23:59:59.999Z'],
      ['CW 49', '2025-12-01T00:00:00.000Z|2025-12-07T23:59:59.999Z'],
      ['CW 3 2025', '2025-01-13T00:00:00.000Z|2025-01-19T23:59:59.999Z'],
    ])('should parse "%s" to ISO week range', (input, expected) => {
      const result = parseTemporalExpression(input);
      expect(result).toBe(expected);
    });
  });

  describe('Year Boundary Cases', () => {
    it('should handle KW 1 2025 starting in Dec 2024', () => {
      const result = parseTemporalExpression('KW 1 2025');
      expect(result).toBe('2024-12-30T00:00:00.000Z|2025-01-05T23:59:59.999Z');
    });

    it('should handle KW 53 for years with 53 weeks', () => {
      const result = parseTemporalExpression('KW 53 2020');
      expect(result).toBe('2020-12-28T00:00:00.000Z|2021-01-03T23:59:59.999Z');
    });
  });
});
```

#### Category 8: Invalid Input (Edge Cases)
```typescript
describe('Invalid Input Handling', () => {
  it.each([
    ['KW 0', null], // Invalid week number
    ['KW 54', null], // Invalid week number
    ['week 0', null],
    ['invalid string', null],
    ['', null],
  ])('should return null for invalid input "%s"', (input, expected) => {
    const result = parseTemporalExpression(input);
    expect(result).toBe(expected);
  });
});
```

### 4. Package.json Setup

Add to `worker/package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  },
  "devDependencies": {
    "vitest": "^1.2.0",
    "@vitest/ui": "^1.2.0",
    "@vitest/coverage-v8": "^1.2.0"
  }
}
```

### 5. Vitest Config

Create `worker/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
```

### 6. Refactoring for Testability

**Current Issue:** `parseTemporalExpression()` is embedded in `index.ts` and uses `new Date()` internally, making it hard to test with fixed dates.

**Solution:** Extract to separate module with dependency injection:

Create `worker/src/temporal-parser.ts`:

```typescript
export interface TemporalParserOptions {
  now?: Date;
}

export function parseTemporalExpression(
  expr: string,
  options: TemporalParserOptions = {}
): string | null {
  const now = options.now || new Date();
  const lowerExpr = expr.toLowerCase().trim();

  // ... existing parsing logic ...
  // Replace all `new Date()` with `now`
}
```

Update `worker/src/index.ts`:

```typescript
import { parseTemporalExpression } from './temporal-parser';

// In /api/recall endpoint:
const sinceDate = lowerBoundExpr
  ? parseTemporalExpression(lowerBoundExpr, { now: new Date() })
  : null;
```

### 7. CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd worker && npm ci
      - run: cd worker && npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./worker/coverage/coverage-final.json
```

### 8. Test Execution

```bash
# Run all tests
cd worker && npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch

# Run specific test file
npm test temporal-parser.test.ts

# Run specific test pattern
npm test -- -t "Calendar Week"
```

### 9. Expected Output

```
✓ worker/src/temporal-parser.test.ts (65 tests)
  ✓ Basic Keywords (6 tests)
  ✓ Extended Fixed Patterns (13 tests)
  ✓ Flexible N-Unit Patterns (15 tests)
    ✓ Days (5 tests)
    ✓ Weeks (5 tests)
    ✓ Months (5 tests)
  ✓ Weekday References (6 tests)
  ✓ Seit/Since Expressions (8 tests)
  ✓ Legacy Formats (3 tests)
  ✓ Calendar Week Patterns (14 tests)
    ✓ German KW (6 tests)
    ✓ English Week (6 tests)
    ✓ Year Boundary Cases (2 tests)
  ✓ Invalid Input Handling (5 tests)

Test Files  1 passed (1)
     Tests  65 passed (65)
  Start at  12:00:00
  Duration  123ms

% Coverage report from v8
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |     100 |      100 |     100 |     100 |
 temporal-parser.ts |     100 |      100 |     100 |     100 |
--------------------|---------|----------|---------|---------|
```

## Implementation Checklist

- [ ] Install Vitest and dependencies
- [ ] Create `vitest.config.ts`
- [ ] Extract `parseTemporalExpression()` to `temporal-parser.ts`
- [ ] Add `now` parameter for testability
- [ ] Update imports in `index.ts`
- [ ] Create `temporal-parser.test.ts`
- [ ] Write 65 tests (all categories)
- [ ] Add test scripts to `package.json`
- [ ] Run tests and verify 100% pass
- [ ] Add CI/CD workflow
- [ ] Update CHANGELOG.md
- [ ] Create TESTING.md documentation
- [ ] Commit and push

## Success Criteria

1. ✅ All 65 temporal patterns have tests
2. ✅ Tests use mocked dates for determinism
3. ✅ 100% test pass rate
4. ✅ 100% code coverage for temporal parser
5. ✅ Tests run in < 1 second
6. ✅ CI/CD integration working
7. ✅ Year boundary cases covered (KW 1 2025, KW 53)
8. ✅ Invalid input returns null gracefully
9. ✅ Tests are maintainable and readable
10. ✅ Documentation includes test examples

## Files to Create/Modify

**New Files:**
1. `worker/src/temporal-parser.ts` - Extracted parser module
2. `worker/src/temporal-parser.test.ts` - Test suite (65 tests)
3. `worker/vitest.config.ts` - Vitest configuration
4. `worker/TESTING.md` - Test documentation
5. `.github/workflows/test.yml` - CI/CD workflow

**Modified Files:**
1. `worker/package.json` - Add test scripts and dependencies
2. `worker/src/index.ts` - Import from temporal-parser module
3. `CHANGELOG.md` - Document test coverage
4. `README.md` - Add testing section

## Estimated Complexity

**Medium** - Requires refactoring for testability, but logic is already implemented.

**Time Estimate:** 2-3 hours (with AMP: 30-45 minutes)

## Benefits

1. **Confidence** - Breaking changes detected immediately
2. **Documentation** - Tests serve as executable documentation
3. **Regression Prevention** - Future changes won't break existing patterns
4. **Refactoring Safety** - Can optimize parser with confidence
5. **CI/CD Integration** - Automated testing on every commit
6. **Coverage Metrics** - Know exactly which code paths are tested

## Example Test Run

```bash
$ cd worker && npm test

 RUN  v1.2.0

 ✓ src/temporal-parser.test.ts (65) 123ms
   ✓ Basic Keywords (6)
   ✓ Extended Fixed Patterns (13)
   ✓ Flexible N-Unit Patterns (15)
   ✓ Weekday References (6)
   ✓ Seit/Since Expressions (8)
   ✓ Legacy Formats (3)
   ✓ Calendar Week Patterns (14)
   ✓ Invalid Input Handling (5)

 Test Files  1 passed (1)
      Tests  65 passed (65)
   Start at  12:00:00
   Duration  123ms (transform 8ms, setup 0ms, collect 15ms, tests 123ms, environment 0ms, prepare 12ms)

 % Coverage report from v8
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
temporal-parser.ts  |     100 |      100 |     100 |     100 |
```

This comprehensive test suite ensures all 65 temporal patterns work reliably and will continue to work as the codebase evolves.
