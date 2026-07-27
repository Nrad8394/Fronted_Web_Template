/**
 * Automatic `FormData` conversion for payloads containing files.
 *
 * Without this, a form with a file input has to be special-cased at every
 * call site: build `FormData` by hand, remember which fields are files,
 * remember not to set `Content-Type`. Detecting it once here means
 * `create.mutateAsync({ name, avatar: someFile })` just works.
 *
 * The three details that make file uploads fail, all handled below:
 *
 * 1. **Never set `Content-Type` yourself.** A multipart body needs a boundary
 *    token that only the browser can generate. Writing
 *    `'multipart/form-data'` by hand omits it and the server sees a body it
 *    cannot parse — the single most common file-upload bug, and the reason
 *    the header is conspicuously absent from `maybeFormData`'s callers.
 *
 * 2. **`null` is not the same as omitted.** Skipping null keys means "leave
 *    this field alone"; sending an empty string means "clear it". Django
 *    treats them differently, so the caller has to be able to express both.
 *    Explicit `null` becomes `''` here; `undefined` is dropped.
 *
 * 3. **Booleans need Django's spelling.** `String(true)` is `"true"`, which
 *    DRF's `BooleanField` accepts — but `String(false)` is `"false"`, and a
 *    naive `if (value)` guard would drop it entirely, silently turning every
 *    `false` into "unchanged". Booleans are written explicitly.
 */

/** True if the value tree contains anything the browser must upload. */
export function containsFile(value: unknown): boolean {
  if (value instanceof File || value instanceof Blob) return true;
  if (value instanceof FileList) return value.length > 0;
  if (Array.isArray(value)) return value.some(containsFile);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.values(value as Record<string, unknown>).some(containsFile);
  }
  return false;
}

function appendValue(form: FormData, key: string, value: unknown): void {
  if (value === undefined) return;

  if (value === null) {
    // Explicit clear. See note 2.
    form.append(key, '');
    return;
  }

  if (value instanceof File || value instanceof Blob) {
    form.append(key, value);
    return;
  }

  if (value instanceof FileList) {
    // A file input yields a FileList even when it holds one file.
    for (const file of Array.from(value)) form.append(key, file);
    return;
  }

  if (value instanceof Date) {
    // ISO 8601, matching the API's DATETIME_FORMAT. Locale-dependent
    // `toString()` here produces dates the server rejects in some timezones
    // and silently misparses in others.
    form.append(key, value.toISOString());
    return;
  }

  if (Array.isArray(value)) {
    // Repeat the key rather than joining. Django's `QueryDict.getlist()`
    // expects `?tag=a&tag=b`; a comma-joined string arrives as one value.
    for (const item of value) appendValue(form, key, item);
    return;
  }

  if (typeof value === 'boolean') {
    form.append(key, value ? 'true' : 'false'); // See note 3.
    return;
  }

  if (typeof value === 'object') {
    // Nested objects have no canonical multipart encoding. JSON is the
    // convention DRF understands via a JSONField or a custom parser.
    form.append(key, JSON.stringify(value));
    return;
  }

  form.append(key, String(value));
}

/** Convert a plain object to `FormData`. */
export function toFormData(payload: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    appendValue(form, key, value);
  }
  return form;
}

/**
 * Pass through `FormData`, convert objects that hold files, leave the rest.
 *
 * Plain JSON stays JSON: it is smaller on the wire, and it preserves types
 * (numbers stay numbers, `null` stays `null`) that multipart flattens to
 * strings. Converting unconditionally would force the server to re-parse
 * every field of every request.
 */
export function maybeFormData<T>(payload: T): T | FormData {
  if (payload instanceof FormData) return payload;
  if (!payload || typeof payload !== 'object') return payload;
  if (!containsFile(payload)) return payload;
  return toFormData(payload as Record<string, unknown>);
}
