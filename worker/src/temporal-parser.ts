/**
 * Temporal Expression Parser
 * Parses natural language temporal expressions to ISO 8601 dates
 * Supports English and German, 65+ patterns
 */

export interface TemporalParserOptions {
  now?: Date;
}

// Number words to digit mapping (for voice dictation like "KW eins")
const numberWords: Record<string, number> = {
  // German
  'eins': 1, 'zwei': 2, 'drei': 3, 'vier': 4, 'fünf': 5,
  'sechs': 6, 'sieben': 7, 'acht': 8, 'neun': 9, 'zehn': 10,
  'elf': 11, 'zwölf': 12, 'dreizehn': 13, 'vierzehn': 14, 'fünfzehn': 15,
  'sechzehn': 16, 'siebzehn': 17, 'achtzehn': 18, 'neunzehn': 19, 'zwanzig': 20,
  'einundzwanzig': 21, 'zweiundzwanzig': 22, 'dreiundzwanzig': 23, 'vierundzwanzig': 24,
  'fünfundzwanzig': 25, 'sechsundzwanzig': 26, 'siebenundzwanzig': 27, 'achtundzwanzig': 28,
  'neunundzwanzig': 29, 'dreißig': 30, 'einunddreißig': 31, 'zweiunddreißig': 32,
  'dreiunddreißig': 33, 'vierunddreißig': 34, 'fünfunddreißig': 35, 'sechsunddreißig': 36,
  'siebenunddreißig': 37, 'achtunddreißig': 38, 'neununddreißig': 39, 'vierzig': 40,
  'einundvierzig': 41, 'zweiundvierzig': 42, 'dreiundvierzig': 43, 'vierundvierzig': 44,
  'fünfundvierzig': 45, 'sechsundvierzig': 46, 'siebenundvierzig': 47, 'achtundvierzig': 48,
  'neunundvierzig': 49, 'fünfzig': 50, 'einundfünfzig': 51, 'zweiundfünfzig': 52, 'dreiundfünfzig': 53,
  // English
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
  'twenty-one': 21, 'twenty-two': 22, 'twenty-three': 23, 'twenty-four': 24,
  'twenty-five': 25, 'twenty-six': 26, 'twenty-seven': 27, 'twenty-eight': 28,
  'twenty-nine': 29, 'thirty': 30, 'thirty-one': 31, 'thirty-two': 32,
  'thirty-three': 33, 'thirty-four': 34, 'thirty-five': 35, 'thirty-six': 36,
  'thirty-seven': 37, 'thirty-eight': 38, 'thirty-nine': 39, 'forty': 40,
  'forty-one': 41, 'forty-two': 42, 'forty-three': 43, 'forty-four': 44,
  'forty-five': 45, 'forty-six': 46, 'forty-seven': 47, 'forty-eight': 48,
  'forty-nine': 49, 'fifty': 50, 'fifty-one': 51, 'fifty-two': 52, 'fifty-three': 53
};

// Parse number from digit or word
function parseNumber(str: string): number | null {
  const trimmed = str.trim().toLowerCase();
  // Try digit first
  const digit = parseInt(trimmed);
  if (!isNaN(digit)) return digit;
  // Try word
  return numberWords[trimmed] ?? null;
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
  // German: "KW 49", "KW49", "KW 1 2024", "Kalenderwoche 3", "KW eins", "KW fünf"
  // Supports both digits and number words (for voice dictation)
  let kwMatch = lowerSince.match(/^(?:kw|kalenderwoche)\s*(\d{1,2}|[a-zäöüß]+)(?:\s+(\d{4}))?$/i);
  if (kwMatch) {
    const weekNum = parseNumber(kwMatch[1]);
    if (weekNum === null) return null; // Could not parse number
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

  // English: "week 52", "week52", "week 1 2024", "CW 49", "week one", "week five"
  // Supports both digits and number words (for voice dictation)
  let weekMatch = lowerSince.match(/^(?:week|cw)\s*(\d{1,2}|[a-z-]+)(?:\s+(\d{4}))?$/i);
  if (weekMatch) {
    const weekNum = parseNumber(weekMatch[1]);
    if (weekNum === null) return null; // Could not parse number
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
