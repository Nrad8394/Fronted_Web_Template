/**
 * Turn any failure into one predictable object.
 *
 * The backend template guarantees a single error envelope for every non-2xx
 * response (see `apps/core/exceptions.py`), so the happy path here is a
 * direct read — no shape sniffing:
 *
 *     {
 *       "error": {
 *         "type": "validation_error",
 *         "message": "Please correct the errors below.",
 *         "detail": [{ "field": "email", "code": "required", "message": "..." }],
 *         "request_id": "..."
 *       }
 *     }
 *
 * Compare against what a client is forced into when the API has no contract.
 * This is real code from a production frontend built without one:
 *
 *     const responseText = JSON.stringify(data);
 *     const pattern = /ErrorDetail\(string='([^']+)',\s*code='([^']+)'\)/g;
 *     const matches = Array.from(responseText.matchAll(pattern));
 *
 * That is TypeScript regex-matching the `repr()` of a Python object out of a
 * JSON body — reached by falling through a chain of guesses about whether
 * `data` was a string, an object, an array, or a nested serializer tree. It
 * ran to roughly 150 lines and had to be extended every time a new endpoint
 * failed in a new way.
 *
 * The fallbacks below exist for the cases the envelope cannot cover: network
 * failures with no response at all, a gateway returning HTML, and any legacy
 * or third-party endpoint that predates the contract. They are a safety net,
 * not the main path — if you find yourself extending them, fix the API
 * instead.
 */

import type { AxiosError } from 'axios';
import axios from 'axios';

/** Stable slugs from `apps/core/exceptions.py`. Branch on these, not on prose. */
export type ApiErrorType =
  | 'validation_error'
  | 'authentication_failed'
  | 'not_authenticated'
  | 'permission_denied'
  | 'not_found'
  | 'method_not_allowed'
  | 'parse_error'
  | 'unsupported_media_type'
  | 'throttled'
  | 'server_error'
  | 'network_error'
  | 'cancelled'
  | 'error';

export interface FieldError {
  /** Dotted path (`items.1.quantity`), or `null` for object-level errors. */
  field: string | null;
  code: string | null;
  message: string;
}

export interface NormalizedError {
  type: ApiErrorType;
  /** One sentence, safe to show directly to a user. */
  message: string;
  fieldErrors: FieldError[];
  status: number | null;
  requestId: string | null;
  /** Seconds to wait, on a 429. */
  retryAfter: number | null;
  /** The original error, for logging. Never render this. */
  cause: unknown;
}

interface ErrorEnvelope {
  error: {
    type?: string;
    message?: string;
    detail?: Array<{ field?: string | null; code?: string | null; message?: string }>;
    request_id?: string;
    retry_after?: number;
  };
}

function isEnvelope(data: unknown): data is ErrorEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as ErrorEnvelope).error === 'object' &&
    (data as ErrorEnvelope).error !== null
  );
}

const STATUS_FALLBACK: Record<number, { type: ApiErrorType; message: string }> = {
  400: { type: 'validation_error', message: 'The request could not be processed.' },
  401: { type: 'not_authenticated', message: 'Please sign in to continue.' },
  403: { type: 'permission_denied', message: 'You do not have access to this.' },
  404: { type: 'not_found', message: 'That could not be found.' },
  405: { type: 'method_not_allowed', message: 'That action is not allowed here.' },
  409: { type: 'error', message: 'That conflicts with the current state.' },
  413: { type: 'error', message: 'That file is too large.' },
  415: { type: 'unsupported_media_type', message: 'That file type is not supported.' },
  429: { type: 'throttled', message: 'Too many requests. Please wait a moment.' },
  500: { type: 'server_error', message: 'Something went wrong on our end.' },
  502: { type: 'server_error', message: 'The server is unreachable. Please try again.' },
  503: { type: 'server_error', message: 'The service is temporarily unavailable.' },
  504: { type: 'server_error', message: 'The server took too long to respond.' },
};

/**
 * Last-resort extraction for a response that is not in the envelope.
 *
 * Handles DRF's native shapes (`{detail}`, `{field: [msg]}`) and nothing more
 * exotic. Deliberately shallow: a deeper walker is how the 150-line handler
 * described above came to exist, one special case at a time.
 */
function legacyShape(data: unknown): { message: string | null; fields: FieldError[] } {
  if (typeof data === 'string' && data.trim() && !data.trim().startsWith('<')) {
    return { message: data.trim().slice(0, 300), fields: [] };
  }

  if (typeof data !== 'object' || data === null) {
    return { message: null, fields: [] };
  }

  const record = data as Record<string, unknown>;

  if (typeof record.detail === 'string') {
    return { message: record.detail, fields: [] };
  }

  const fields: FieldError[] = [];
  for (const [key, value] of Object.entries(record)) {
    const text = Array.isArray(value)
      ? value.filter((v) => typeof v === 'string').join(' ')
      : typeof value === 'string'
        ? value
        : null;
    if (!text) continue;
    fields.push({
      field: key === 'non_field_errors' ? null : key,
      code: null,
      message: text,
    });
  }

  const objectLevel = fields.find((f) => f.field === null);
  return {
    message: objectLevel?.message ?? (fields.length === 1 ? fields[0].message : null),
    fields,
  };
}

/**
 * Normalize anything thrown by the API layer.
 *
 * Total: it never throws and always returns a `message` fit to display.
 */
export function normalizeError(error: unknown): NormalizedError {
  const base: NormalizedError = {
    type: 'error',
    message: 'Something went wrong. Please try again.',
    fieldErrors: [],
    status: null,
    requestId: null,
    retryAfter: null,
    cause: error,
  };

  if (axios.isCancel(error)) {
    // A cancelled request is usually the app's own doing — a component
    // unmounted, a search box debounced. Surfacing it as an error shows the
    // user a failure for something that was working correctly.
    return { ...base, type: 'cancelled', message: 'Request cancelled.' };
  }

  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? { ...base, message: error.message } : base;
  }

  const axiosError = error as AxiosError<unknown>;

  if (!axiosError.response) {
    const timedOut = axiosError.code === 'ECONNABORTED';
    return {
      ...base,
      type: 'network_error',
      message: timedOut
        ? 'The request timed out. Please try again.'
        : 'Cannot reach the server. Check your connection.',
    };
  }

  const { status, data, headers } = axiosError.response;
  const fallback = STATUS_FALLBACK[status] ?? {
    type: 'error' as ApiErrorType,
    message: base.message,
  };

  const headerRequestId =
    (headers?.['x-request-id'] as string | undefined) ?? null;
  const headerRetryAfter = headers?.['retry-after']
    ? Number(headers['retry-after'])
    : null;

  if (isEnvelope(data)) {
    const envelope = data.error;
    const fieldErrors: FieldError[] = (envelope.detail ?? []).map((entry) => ({
      field: entry.field ?? null,
      code: entry.code ?? null,
      message: entry.message ?? '',
    }));

    return {
      type: (envelope.type as ApiErrorType) ?? fallback.type,
      message: envelope.message || fallback.message,
      fieldErrors,
      status,
      requestId: envelope.request_id ?? headerRequestId,
      retryAfter: envelope.retry_after ?? headerRetryAfter,
      cause: error,
    };
  }

  const legacy = legacyShape(data);
  return {
    type: fallback.type,
    message: legacy.message || fallback.message,
    fieldErrors: legacy.fields,
    status,
    requestId: headerRequestId,
    retryAfter: headerRetryAfter,
    cause: error,
  };
}

/**
 * Map field errors onto a form library.
 *
 * With react-hook-form:
 *
 *     const { fieldErrors, message } = normalizeError(err);
 *     applyFieldErrors(fieldErrors, (field, msg) =>
 *       setError(field as never, { message: msg }),
 *     );
 *     if (!fieldErrors.some((e) => e.field)) toast.error(message);
 *
 * The dotted paths from the backend (`items.1.quantity`) are already the
 * format react-hook-form uses for nested field arrays, so they pass through
 * unchanged — which is the whole reason the backend flattens them.
 */
export function applyFieldErrors(
  fieldErrors: FieldError[],
  setError: (field: string, message: string) => void,
): void {
  for (const entry of fieldErrors) {
    if (entry.field) setError(entry.field, entry.message);
  }
}

/** Was this a session problem, rather than something the user can fix? */
export function isAuthError(error: NormalizedError): boolean {
  return error.type === 'not_authenticated' || error.type === 'authentication_failed';
}

/** Worth retrying automatically? */
export function isRetryable(error: NormalizedError): boolean {
  if (error.type === 'network_error') return true;
  return error.status !== null && error.status >= 500;
}
