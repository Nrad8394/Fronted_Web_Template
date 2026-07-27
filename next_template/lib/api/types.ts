/**
 * Shapes the API returns.
 *
 * `Paginated<T>` mirrors `apps/core/pagination.py` on the backend exactly.
 * The two are a contract: change one and the other is wrong. If you alter the
 * paginator's response, update this file in the same commit.
 */

/** Response from `StandardResultsSetPagination`. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  page_size: number;
  total_pages: number;
  current_page: number;
  results: T[];
}

/** Response from `StandardCursorPagination` — no counts, by design. */
export interface CursorPaginated<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Query parameters every `BaseModelViewSet` list endpoint accepts. */
export interface ListParams {
  page?: number;
  page_size?: number;
  /** Free-text search across the view's `search_fields`. */
  search?: string;
  /** Field name; prefix with `-` for descending. */
  ordering?: string;
  /** `true` returns only soft-deleted records — the trash view. */
  is_deleted?: boolean;
  /** `true` returns active and deleted together. */
  show_deleted?: boolean;
  /** Any additional filterset field. */
  [key: string]: string | number | boolean | string[] | undefined;
}

/** Fields `BaseModel` adds to every record. */
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
  /** Annotated by `BaseModelViewSet.get_queryset()`. */
  created_by_email?: string;
  updated_by_email?: string;
  deleted_by_email?: string;
}

export interface BulkResult {
  count: number;
  message?: string;
  /** Objects a business rule refused, with the reason. */
  blocked?: Array<{ id: string; error: string }>;
}

export interface BulkImportResult {
  imported: number;
  total_rows: number;
  errors: Array<{ row: number; errors: Record<string, string[]> }>;
  message?: string;
}

export interface Statistics {
  total_count: number;
  filtered_count: number;
  [key: string]: number | string;
}

/**
 * Serialize `ListParams` for axios.
 *
 * Two details that matter:
 *
 * - `undefined` and `''` are dropped. Sending `?search=` makes the backend
 *   filter on an empty string, and — more subtly — changes the react-query
 *   cache key, so a cleared search box misses the cache it just populated.
 * - Arrays repeat the key (`?tag=a&tag=b`) rather than joining with commas,
 *   which is what Django's `QueryDict.getlist()` expects.
 */
export function toQueryParams(params?: ListParams): Record<string, string | string[]> {
  if (!params) return {};

  const output: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    output[key] = Array.isArray(value) ? value.map(String) : String(value);
  }

  return output;
}
