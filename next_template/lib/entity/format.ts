/**
 * Value formatting for columns and detail views.
 *
 * All of it goes through `Intl`, which is in every browser and handles the
 * locale, currency placement, digit grouping and calendar rules that a
 * hand-rolled formatter gets wrong. The source project's equivalent
 * (`primitives/utils/formatting.ts`, 226 lines) reimplemented several of
 * these; this is the same capability in a third of the space because it
 * delegates.
 */

import type { BadgeTone, ColumnFormat } from './types';

/** Reads a dotted path (`"owner.email"`), returning undefined if any hop is null. */
export function readPath(row: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value === null || value === undefined) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, row);
}

/**
 * Formatter instances are cached.
 *
 * `new Intl.NumberFormat(...)` is expensive — construction dominates its cost.
 * Creating one per cell means a 20×8 table builds 160 formatters per render.
 * Keyed by locale+options so the cache stays correct.
 */
const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function numberFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cacheKey = `${locale}:${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatters.set(cacheKey, formatter);
  }
  return formatter;
}

function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${locale}:${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(cacheKey, formatter);
  }
  return formatter;
}

export interface FormatOptions {
  locale?: string;
  currency?: string;
  /** Shown for null/undefined/empty. An em dash reads better than a blank cell. */
  placeholder?: string;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "3 days ago" / "in 2 hours". */
export function formatRelative(value: unknown, locale = 'en'): string {
  const date = parseDate(value);
  if (!date) return '';

  const seconds = (date.getTime() - Date.now()) / 1000;
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, secondsPerUnit] of units) {
    if (Math.abs(seconds) >= secondsPerUnit) {
      return formatter.format(Math.round(seconds / secondsPerUnit), unit);
    }
  }
  return formatter.format(Math.round(seconds), 'second');
}

export function formatValue(
  value: unknown,
  format: ColumnFormat = 'text',
  options: FormatOptions = {},
): string {
  const { locale = 'en', currency = 'USD', placeholder = '—' } = options;

  // Note `false` and `0` are NOT empty — a boolean column showing "—" instead
  // of "No", or a count showing "—" instead of "0", is a real bug and the
  // reason this checks the three cases explicitly rather than using `!value`.
  if (value === null || value === undefined || value === '') return placeholder;

  switch (format) {
    case 'number':
      return typeof value === 'number' || !Number.isNaN(Number(value))
        ? numberFormatter(locale, {}).format(Number(value))
        : String(value);

    case 'currency': {
      const amount = Number(value);
      if (Number.isNaN(amount)) return String(value);
      return numberFormatter(locale, {
        style: 'currency',
        currency,
      }).format(amount);
    }

    case 'percent': {
      const amount = Number(value);
      if (Number.isNaN(amount)) return String(value);
      // Intl expects a fraction, and APIs almost always send 42 for "42%".
      // Dividing here is the convention; document it if yours differs.
      return numberFormatter(locale, {
        style: 'percent',
        maximumFractionDigits: 2,
      }).format(amount / 100);
    }

    case 'date': {
      const date = parseDate(value);
      return date
        ? dateFormatter(locale, { dateStyle: 'medium' }).format(date)
        : String(value);
    }

    case 'datetime': {
      const date = parseDate(value);
      return date
        ? dateFormatter(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
        : String(value);
    }

    case 'relative':
      return formatRelative(value, locale) || String(value);

    case 'boolean':
      return value ? 'Yes' : 'No';

    default:
      return String(value);
  }
}

/**
 * Default badge tone from a value.
 *
 * A heuristic over the status vocabularies Django projects tend to use.
 * Override per column with `tone` — this is a convenience, not a contract,
 * and it should never be the only signal (see the accessibility note in
 * `entity-list.tsx`).
 */
export function defaultTone(value: unknown): BadgeTone {
  const text = String(value ?? '').toLowerCase();

  if (['active', 'approved', 'paid', 'completed', 'success', 'verified', 'true'].includes(text)) {
    return 'success';
  }
  if (['pending', 'draft', 'processing', 'partial', 'review'].includes(text)) {
    return 'warning';
  }
  if (['failed', 'rejected', 'cancelled', 'canceled', 'overdue', 'error', 'inactive'].includes(text)) {
    return 'danger';
  }
  if (['info', 'new', 'scheduled'].includes(text)) return 'info';

  return 'neutral';
}
