import { describe, expect, it } from 'vitest';

import { containsFile, maybeFormData, toFormData } from './form-data';

/**
 * These are the cases that silently corrupt a request rather than failing
 * loudly, which is why they are pinned. Every one of them produces a
 * plausible-looking payload that the server misinterprets.
 */
describe('containsFile', () => {
  it('finds a file nested in an object', () => {
    const file = new File(['x'], 'a.txt');
    expect(containsFile({ name: 'n', avatar: file })).toBe(true);
  });

  it('finds a file inside an array', () => {
    const file = new File(['x'], 'a.txt');
    expect(containsFile({ attachments: [file] })).toBe(true);
  });

  it('treats an empty FileList as no file', () => {
    // An untouched file input reports an empty FileList, not null. Counting
    // it as a file would push every form to multipart for nothing.
    const input = document.createElement('input');
    input.type = 'file';
    expect(containsFile({ avatar: input.files })).toBe(false);
  });

  it('is false for a plain payload', () => {
    expect(containsFile({ name: 'n', count: 3, when: new Date() })).toBe(false);
  });
});

describe('toFormData', () => {
  it('keeps `false` instead of dropping it', () => {
    // The bug this guards: a truthiness check drops `false` entirely, so the
    // server sees the field as absent and leaves the old value in place.
    // Unchecking a box then appears to do nothing.
    const form = toFormData({ is_active: false });
    expect(form.get('is_active')).toBe('false');
  });

  it('keeps `0`', () => {
    const form = toFormData({ stock: 0 });
    expect(form.get('stock')).toBe('0');
  });

  it('sends explicit null as an empty string, and omits undefined', () => {
    // null means "clear this field", undefined means "do not touch it".
    // Collapsing the two makes it impossible to clear a value.
    const form = toFormData({ cleared: null, untouched: undefined });
    expect(form.get('cleared')).toBe('');
    expect(form.has('untouched')).toBe(false);
  });

  it('serializes dates as ISO 8601, not locale strings', () => {
    const form = toFormData({ due: new Date('2026-03-04T05:06:07Z') });
    expect(form.get('due')).toBe('2026-03-04T05:06:07.000Z');
  });

  it('repeats the key for arrays rather than joining', () => {
    // Django's QueryDict.getlist() expects ?tag=a&tag=b. A comma-joined
    // string arrives as the single value "a,b".
    const form = toFormData({ tag: ['a', 'b'] });
    expect(form.getAll('tag')).toEqual(['a', 'b']);
  });

  it('JSON-encodes nested objects', () => {
    const form = toFormData({ meta: { a: 1 } });
    expect(form.get('meta')).toBe('{"a":1}');
  });

  it('appends File values as files, not strings', () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    const form = toFormData({ avatar: file });
    expect(form.get('avatar')).toBeInstanceOf(File);
  });
});

describe('maybeFormData', () => {
  it('leaves a file-free payload as a plain object', () => {
    // JSON is smaller and preserves types; multipart flattens everything to
    // strings. Converting unconditionally would make the server re-parse
    // every field of every request.
    const payload = { name: 'n', count: 3 };
    expect(maybeFormData(payload)).toBe(payload);
  });

  it('converts a payload containing a file', () => {
    const payload = { name: 'n', avatar: new File(['x'], 'a.txt') };
    expect(maybeFormData(payload)).toBeInstanceOf(FormData);
  });

  it('passes existing FormData straight through', () => {
    const form = new FormData();
    expect(maybeFormData(form)).toBe(form);
  });

  it('does not choke on null or a primitive', () => {
    expect(maybeFormData(null)).toBe(null);
    expect(maybeFormData('text')).toBe('text');
  });
});
