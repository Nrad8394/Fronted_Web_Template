import { describe, expect, it } from 'vitest';

import { defaultTone, formatValue, readPath } from './format';
import { filterParamName } from './types';
import type { BaseEntity, FilterConfig } from './types';

describe('formatValue — the empty-value rule', () => {
  it('shows the placeholder for null, undefined and empty string', () => {
    expect(formatValue(null)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
    expect(formatValue('')).toBe('—');
  });

  it('does NOT treat 0 as empty', () => {
    // The bug this guards: `if (!value) return '—'` renders a stock count of
    // zero as "—", which reads as "unknown" rather than "none left".
    expect(formatValue(0, 'number')).toBe('0');
    expect(formatValue(0, 'currency')).toBe('$0.00');
  });

  it('does NOT treat false as empty', () => {
    // Same class of bug: a boolean column showing "—" instead of "No".
    expect(formatValue(false, 'boolean')).toBe('No');
    expect(formatValue(true, 'boolean')).toBe('Yes');
  });
});

describe('formatValue — formats', () => {
  it('formats currency with grouping and symbol', () => {
    expect(formatValue(1234.5, 'currency')).toBe('$1,234.50');
  });

  it('treats a percent value as already scaled', () => {
    // APIs almost always send 42 for "42%". Documented convention; pinned so
    // a change to it is a deliberate, visible decision.
    expect(formatValue(42, 'percent')).toBe('42%');
  });

  it('groups large numbers', () => {
    expect(formatValue(1234567, 'number')).toBe('1,234,567');
  });

  it('falls back to the raw value when a number cannot be parsed', () => {
    expect(formatValue('n/a', 'currency')).toBe('n/a');
  });

  it('falls back to the raw value for an unparseable date', () => {
    expect(formatValue('not-a-date', 'date')).toBe('not-a-date');
  });
});

describe('readPath', () => {
  it('reads a nested value', () => {
    expect(readPath({ owner: { email: 'a@b.c' } }, 'owner.email')).toBe('a@b.c');
  });

  it('returns undefined instead of throwing when a hop is null', () => {
    // A nullable FK renders an empty cell rather than crashing the table.
    expect(readPath({ owner: null }, 'owner.email')).toBeUndefined();
  });

  it('returns undefined for a missing path', () => {
    expect(readPath({}, 'a.b.c')).toBeUndefined();
  });
});

describe('defaultTone', () => {
  it('maps common status vocabularies', () => {
    expect(defaultTone('active')).toBe('success');
    expect(defaultTone('pending')).toBe('warning');
    expect(defaultTone('failed')).toBe('danger');
  });

  it('is case-insensitive', () => {
    expect(defaultTone('ACTIVE')).toBe('success');
  });

  it('falls back to neutral for anything unrecognised', () => {
    expect(defaultTone('bespoke-state')).toBe('neutral');
    expect(defaultTone(null)).toBe('neutral');
  });
});

describe('filterParamName', () => {
  const filter = (over: Partial<FilterConfig<BaseEntity>>): FilterConfig<BaseEntity> => ({
    key: 'status',
    label: 'Status',
    type: 'select',
    ...over,
  });

  it('omits the suffix for an exact lookup', () => {
    // ?status=active, not ?status__exact=active. Both work in Django; the
    // short form is what people expect to read in a URL.
    expect(filterParamName(filter({}))).toBe('status');
    expect(filterParamName(filter({ lookup: 'exact' }))).toBe('status');
  });

  it('appends the Django lookup suffix otherwise', () => {
    expect(filterParamName(filter({ key: 'price', lookup: 'gte' }))).toBe('price__gte');
    expect(filterParamName(filter({ key: 'name', lookup: 'icontains' }))).toBe(
      'name__icontains',
    );
  });
});
