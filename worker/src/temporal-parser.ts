/**
 * Temporal Expression Parser
 * Parses natural language temporal expressions to ISO 8601 dates
 * Supports English and German, 65+ patterns
 */

export interface TemporalParserOptions {
  now?: Date;
}

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
function getMondayOfWeekNum(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // Monday=0
  const week1Monday = new Date(year, 0, 4 - jan4DayOfWeek);
  const targetMonday = new Date(week1Monday);
  targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7);
  return new Date(targetMonday.getFullYear(), targetMonday.getMonth(), targetMonday.getDate());
}

// Helper to get Sunday (last day) of ISO week N in year Y
function getSundayOfWeek(year: number, week: number): Date {
  const monday = getMondayOfWeekNum(year, week);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

// Parse relative time expressions to ISO date (works for both lower and upper bounds)
export function parseTemporalExpression(
  expr: string,
  options: TemporalParserOptions = {}
): string | null {
  const now = options.now || new Date();
  const lowerSince = expr.toLowerCase().trim();

  // Helper to get start of day (00:00:00)
  const getStartOfDay = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  // Helper to get Monday of the given week
  const getMondayOfWeek = (date: Date): Date => {
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return getStartOfDay(new Date(date.getTime() - daysToMonday * 24 * 60 * 60 * 1000));
  };

  // Helper to get first day of month
  const getFirstOfMonth = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  // Helper to get first day of year
  const getFirstOfYear = (date: Date): Date => {
    return new Date(date.getFullYear(), 0, 1);
  };

  // Weekday names mapping
  const weekdayNames: Record<string, number> = {
    // English (Sunday=0, Monday=1, ..., Saturday=6)
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6,
    // German
    'sonntag': 0, 'montag': 1, 'dienstag': 2, 'mittwoch': 3,
    'donnerstag': 4, 'freitag': 5, 'samstag': 6
  };

  // Helper to get most recent weekday (or previous week if today is that weekday)
  const getMostRecentWeekday = (targetDay: number): Date => {
    const dayOfWeek = now.getDay();
    let daysBack = (dayOfWeek - targetDay + 7) % 7;
    // If it's the same day, get last week's
    if (daysBack === 0) {
      daysBack = 7;
    }
    return getStartOfDay(new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000));
  };

  // Helper to get previous occurrence of a weekday
  const getPreviousWeekday = (targetDay: number): Date => {
    const dayOfWeek = now.getDay();
    let daysBack = (dayOfWeek - targetDay + 7) % 7;
    if (daysBack === 0) {
      daysBack = 7;
    }
    return getStartOfDay(new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000));
  };

  // Basic fixed patterns (single keywords)
  if (lowerSince === 'today' || lowerSince === 'heute') {
    return getStartOfDay(now).toISOString();
  }
  if (lowerSince === 'yesterday' || lowerSince === 'gestern') {
    return getStartOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000)).toISOString();
  }
  if (lowerSince === 'this week' || lowerSince === 'diese woche') {
    return getMondayOfWeek(now).toISOString();
  }

  // Extended fixed patterns
  if (lowerSince === 'last week' || lowerSince === 'letzte woche' || lowerSince === 'vergangene woche') {
    const lastWeekMonday = getMondayOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    return lastWeekMonday.toISOString();
  }
  if (lowerSince === 'this month' || lowerSince === 'diesen monat' || lowerSince === 'diesem monat') {
    return getFirstOfMonth(now).toISOString();
  }
  if (lowerSince === 'last month' || lowerSince === 'letzten monat' || lowerSince === 'vergangenen monat') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return getFirstOfMonth(lastMonth).toISOString();
  }
  if (lowerSince === 'this year' || lowerSince === 'dieses jahr') {
    return getFirstOfYear(now).toISOString();
  }
  if (lowerSince === 'last year' || lowerSince === 'letztes jahr') {
    return getFirstOfYear(new Date(now.getFullYear() - 1, 0, 1)).toISOString();
  }

  // Parse "Xd" format (e.g., "7d" = 7 days ago)
  const daysMatch = lowerSince.match(/^(\d+)d$/);
  if (daysMatch) {
    const daysAgo = parseInt(daysMatch[1]);
    const date = getStartOfDay(new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000));
    return date.toISOString();
  }

  // Flexible N-unit patterns
  // "last N days" / "past N days" / "letzten N Tage"
  let match = lowerSince.match(/^(?:last|past|letzten)\s+(\d+)\s+(?:days?|tage)$/i);
  if (match) {
    const daysAgo = parseInt(match[1]);
    return getStartOfDay(new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)).toISOString();
  }

  // "last N weeks" / "past N weeks" / "letzten N Wochen"
  match = lowerSince.match(/^(?:last|past|letzten)\s+(\d+)\s+(?:weeks?|wochen)$/i);
  if (match) {
    const weeksAgo = parseInt(match[1]);
    const daysAgo = weeksAgo * 7;
    return getStartOfDay(new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)).toISOString();
  }

  // "last N months" / "past N months" / "letzten N Monate"
  match = lowerSince.match(/^(?:last|past|letzten)\s+(\d+)\s+(?:months?|monate)$/i);
  if (match) {
    const monthsAgo = parseInt(match[1]);
    const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    return getFirstOfMonth(target).toISOString();
  }

  // "N days ago" / "vor N Tagen"
  match = lowerSince.match(/^(\d+)\s+days?\s+ago$/i) || lowerSince.match(/^vor\s+(\d+)\s+(?:tag|tage|tagen)$/i);
  if (match) {
    const daysAgo = parseInt(match[1]);
    return getStartOfDay(new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)).toISOString();
  }

  // "N weeks ago" / "vor N Wochen"
  match = lowerSince.match(/^(\d+)\s+weeks?\s+ago$/i) || lowerSince.match(/^vor\s+(\d+)\s+(?:woche|wochen)$/i);
  if (match) {
    const weeksAgo = parseInt(match[1]);
    const daysAgo = weeksAgo * 7;
    return getStartOfDay(new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)).toISOString();
  }

  // "N months ago" / "vor N Monaten"
  match = lowerSince.match(/^(\d+)\s+months?\s+ago$/i) || lowerSince.match(/^vor\s+(\d+)\s+(?:monat|monate)$/i);
  if (match) {
    const monthsAgo = parseInt(match[1]);
    const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    return getFirstOfMonth(target).toISOString();
  }

  // Weekday references
  // Check if it's a weekday name (for "most recent" weekday)
  for (const [name, dayNum] of Object.entries(weekdayNames)) {
    if (lowerSince === name) {
      return getMostRecentWeekday(dayNum).toISOString();
    }
  }

  // "last monday" / "letzten montag"
  match = lowerSince.match(/^(?:last|letzten)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag)$/i);
  if (match) {
    const weekdayName = match[1].toLowerCase();
    const dayNum = weekdayNames[weekdayName];
    if (dayNum !== undefined) {
      return getPreviousWeekday(dayNum).toISOString();
    }
  }

  // Since/Seit expressions
  // "seit gestern" / "since yesterday"
  if (lowerSince === 'seit gestern' || lowerSince === 'since yesterday') {
    return getStartOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000)).toISOString();
  }

  // "seit montag" / "since monday" (or any weekday)
  match = lowerSince.match(/^(?:seit|since)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag)$/i);
  if (match) {
    const weekdayName = match[1].toLowerCase();
    const dayNum = weekdayNames[weekdayName];
    if (dayNum !== undefined) {
      return getMostRecentWeekday(dayNum).toISOString();
    }
  }

  // "seit letzter woche" / "since last week"
  if (lowerSince === 'seit letzter woche' || lowerSince === 'since last week') {
    const lastWeekMonday = getMondayOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    return lastWeekMonday.toISOString();
  }

  // "seit diesem monat" / "since this month"
  if (lowerSince === 'seit diesem monat' || lowerSince === 'since this month') {
    return getFirstOfMonth(now).toISOString();
  }

  // Calendar Week patterns (ISO 8601)
  // German: "KW 49", "KW49", "KW 1 2024", "Kalenderwoche 3"
  let kwMatch = lowerSince.match(/^(?:kw|kalenderwoche)\s*(\d{1,2})(?:\s+(\d{4}))?$/i);
  if (kwMatch) {
    const weekNum = parseInt(kwMatch[1]);
    const year = kwMatch[2] ? parseInt(kwMatch[2]) : now.getFullYear();

    // Validate week number (1-53)
    if (weekNum < 1 || weekNum > 53) {
      return null; // Invalid week number
    }

    const monday = getMondayOfWeekNum(year, weekNum);
    const sunday = getSundayOfWeek(year, weekNum);

    // Return range as pipe-separated tuple
    return `${monday.toISOString()}|${sunday.toISOString()}`;
  }

  // English: "week 52", "week52", "week 1 2024", "CW 49"
  let weekMatch = lowerSince.match(/^(?:week|cw)\s*(\d{1,2})(?:\s+(\d{4}))?$/i);
  if (weekMatch) {
    const weekNum = parseInt(weekMatch[1]);
    const year = weekMatch[2] ? parseInt(weekMatch[2]) : now.getFullYear();

    // Validate week number (1-53)
    if (weekNum < 1 || weekNum > 53) {
      return null; // Invalid week number
    }

    const monday = getMondayOfWeekNum(year, weekNum);
    const sunday = getSundayOfWeek(year, weekNum);

    // Return range as pipe-separated tuple
    return `${monday.toISOString()}|${sunday.toISOString()}`;
  }

  // Try parsing as ISO date
  const parsed = new Date(expr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}
