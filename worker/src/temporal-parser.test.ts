import { describe, it, expect } from 'vitest';
import { parseTemporalExpression } from './temporal-parser';

describe('Temporal Parser', () => {
  // Use explicit UTC date to avoid timezone issues
  const testDate = new Date(Date.UTC(2026, 0, 31, 12, 0, 0)); // Saturday, Jan 31, 2026

  describe('Basic Keywords (6 tests)', () => {
    it.each([
      ['today', '2026-01-31T00:00:00.000Z'],
      ['heute', '2026-01-31T00:00:00.000Z'],
      ['yesterday', '2026-01-30T00:00:00.000Z'],
      ['gestern', '2026-01-30T00:00:00.000Z'],
      ['this week', '2026-01-26T00:00:00.000Z'], // Monday
      ['diese woche', '2026-01-26T00:00:00.000Z'],
    ])('should parse "%s" correctly', (input, expected) => {
      const result = parseTemporalExpression(input, { now: testDate });
      expect(result).toBe(expected);
    });
  });

  describe('Extended Fixed Patterns (13 tests)', () => {
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
      const result = parseTemporalExpression(input, { now: testDate });
      expect(result).toBe(expected);
    });
  });

  describe('Flexible N-Unit Patterns (15 tests)', () => {
    describe('Days', () => {
      it.each([
        ['last 3 days', '2026-01-28T00:00:00.000Z'],
        ['past 7 days', '2026-01-24T00:00:00.000Z'],
        ['letzten 5 Tage', '2026-01-26T00:00:00.000Z'],
        ['3 days ago', '2026-01-28T00:00:00.000Z'],
        ['vor 2 Tagen', '2026-01-29T00:00:00.000Z'],
      ])('should parse "%s" correctly', (input, expected) => {
        const result = parseTemporalExpression(input, { now: testDate });
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
        const result = parseTemporalExpression(input, { now: testDate });
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
        const result = parseTemporalExpression(input, { now: testDate });
        expect(result).toBe(expected);
      });
    });
  });

  describe('Weekday References (6 tests)', () => {
    describe('Most Recent Weekday', () => {
      it.each([
        ['monday', '2026-01-26T00:00:00.000Z'], // Last Monday
        ['montag', '2026-01-26T00:00:00.000Z'],
        ['friday', '2026-01-30T00:00:00.000Z'], // Yesterday (Friday)
        ['freitag', '2026-01-30T00:00:00.000Z'],
      ])('should parse "%s" to most recent occurrence', (input, expected) => {
        const result = parseTemporalExpression(input, { now: testDate });
        expect(result).toBe(expected);
      });
    });

    describe('Last [Weekday]', () => {
      it.each([
        ['last monday', '2026-01-26T00:00:00.000Z'], // Previous week's Monday
        ['letzten montag', '2026-01-26T00:00:00.000Z'],
      ])('should parse "%s" to previous week', (input, expected) => {
        const result = parseTemporalExpression(input, { now: testDate });
        expect(result).toBe(expected);
      });
    });
  });

  describe('Seit/Since Expressions (8 tests)', () => {
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
      const result = parseTemporalExpression(input, { now: testDate });
      expect(result).toBe(expected);
    });
  });

  describe('Legacy Formats (3 tests)', () => {
    it.each([
      ['7d', '2026-01-24T00:00:00.000Z'],
      ['30d', '2026-01-01T00:00:00.000Z'],
      ['2024-12-05T12:00:00Z', '2024-12-05T12:00:00.000Z'], // ISO passthrough
    ])('should parse "%s" correctly', (input, expected) => {
      const result = parseTemporalExpression(input, { now: testDate });
      expect(result).toBe(expected);
    });
  });

  describe('Calendar Week Patterns (14 tests)', () => {
    describe('German KW', () => {
      it.each([
        ['KW 5', '2026-01-26T00:00:00.000Z|2026-02-01T23:59:59.999Z'],
        ['KW5', '2026-01-26T00:00:00.000Z|2026-02-01T23:59:59.999Z'],
        ['KW 1 2024', '2024-01-01T00:00:00.000Z|2024-01-07T23:59:59.999Z'],
        ['KW1 2024', '2024-01-01T00:00:00.000Z|2024-01-07T23:59:59.999Z'],
        ['Kalenderwoche 5', '2026-01-26T00:00:00.000Z|2026-02-01T23:59:59.999Z'],
        ['Kalenderwoche 1 2024', '2024-01-01T00:00:00.000Z|2024-01-07T23:59:59.999Z'],
      ])('should parse "%s" to ISO week range', (input, expected) => {
        const result = parseTemporalExpression(input, { now: testDate });
        expect(result).toBe(expected);
      });
    });

    describe('English Week', () => {
      it.each([
        ['week 5', '2026-01-26T00:00:00.000Z|2026-02-01T23:59:59.999Z'],
        ['week5', '2026-01-26T00:00:00.000Z|2026-02-01T23:59:59.999Z'],
        ['week 1 2024', '2024-01-01T00:00:00.000Z|2024-01-07T23:59:59.999Z'],
        ['week1 2024', '2024-01-01T00:00:00.000Z|2024-01-07T23:59:59.999Z'],
        ['CW 5', '2026-01-26T00:00:00.000Z|2026-02-01T23:59:59.999Z'],
        ['CW 1 2024', '2024-01-01T00:00:00.000Z|2024-01-07T23:59:59.999Z'],
      ])('should parse "%s" to ISO week range', (input, expected) => {
        const result = parseTemporalExpression(input, { now: testDate });
        expect(result).toBe(expected);
      });
    });

    describe('Year Boundary Cases', () => {
      it('should handle week 1 of 2025 starting in 2024', () => {
        const result = parseTemporalExpression('KW 1 2025', { now: testDate });
        expect(result).toBe('2024-12-30T00:00:00.000Z|2025-01-05T23:59:59.999Z');
      });

      it('should handle week 52 of 2024', () => {
        const result = parseTemporalExpression('week 52 2024', { now: testDate });
        expect(result).toBe('2024-12-23T00:00:00.000Z|2024-12-29T23:59:59.999Z');
      });
    });
  });

  describe('Invalid Input Handling (5 tests)', () => {
    it('should return null for invalid week 0', () => {
      const result = parseTemporalExpression('KW 0', { now: testDate });
      expect(result).toBeNull();
    });

    it('should return null for invalid week 54', () => {
      const result = parseTemporalExpression('KW 54', { now: testDate });
      expect(result).toBeNull();
    });

    it('should return null for completely invalid input', () => {
      const result = parseTemporalExpression('this is not a date', { now: testDate });
      expect(result).toBeNull();
    });

    it('should be case insensitive', () => {
      const result1 = parseTemporalExpression('TODAY', { now: testDate });
      const result2 = parseTemporalExpression('today', { now: testDate });
      expect(result1).toBe(result2);
    });

    it('should handle ISO date pass-through', () => {
      const result = parseTemporalExpression('2024-12-05T12:00:00Z', { now: testDate });
      expect(result).toBe('2024-12-05T12:00:00.000Z');
    });
  });

  describe('Defaults to current date when no options provided', () => {
    it('should work without options parameter', () => {
      const result = parseTemporalExpression('today');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
