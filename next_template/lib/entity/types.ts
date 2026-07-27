/**
 * The entity configuration contract.
 *
 * One shape, generic over the entity type. There is no normalizer and no
 * alternate spelling of any key — see ANALYSIS.md for what happens when a
 * config-driven library accepts more than one.
 *
 * The load-bearing detail is that keys are `keyof T` rather than `string`:
 *
 *     const config: EntityConfig<Product> = {
 *       columns: [{ key: 'nmae' }],   // ← compile error, not an empty table
 *     };
 *
 * The version this replaces typed its entry point `Record<string, unknown>`,
 * so a typo rendered nothing, silently, at runtime.
 */

import type { ReactNode } from 'react';

/** Minimum an entity must provide. Matches the Django template's `BaseModel`. */
export interface BaseEntity {
  id: string | number;
  [key: string]: unknown;
}

/** A key of T, or a dotted path for nested values (`"owner.email"`). */
export type FieldKey<T> = Extract<keyof T, string> | (string & {});

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

/**
 * How a cell's value is rendered when no `render` is supplied.
 *
 * Twelve, not thirty-three. The source project defined 33 and used 18; the
 * long tail (`rating`, `slider`, `color`, `markdown`, `code`, …) is better
 * served by `render`, which is unbounded and needs no library support.
 */
export type ColumnFormat =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'relative'
  | 'boolean'
  | 'badge'
  | 'email'
  | 'link'
  | 'image';

export interface ColumnConfig<T extends BaseEntity> {
  key: FieldKey<T>;
  header: string;
  format?: ColumnFormat;
  /** Full control. Wins over `format`. */
  render?: (row: T) => ReactNode;
  /** Allow `?ordering=` on this column. Requires the field in the API's `ordering_fields`. */
  sortable?: boolean;
  /** Map a value to a badge tone. Only used with `format: 'badge'`. */
  tone?: (value: unknown, row: T) => BadgeTone;
  width?: string;
  align?: 'left' | 'center' | 'right';
  /**
   * Columns to span out of 2 in `<EntityView>`. Ignored by `<EntityList>`,
   * where a table row has its own layout. Use 2 for long text.
   */
  span?: 1 | 2;
  /**
   * Groups this field under a heading in `<EntityView>`. Ignored by
   * `<EntityList>`.
   *
   * Every finance module in the source project had a `view/tabs.tsx`
   * splitting a long detail view into groups, which is the same need. A
   * heading is the smaller answer than a tab bar: it needs no state, prints
   * correctly, is reachable by Ctrl-F, and does not hide information behind
   * a click. Reach for real tabs only when the groups are genuinely separate
   * concerns rather than one long record.
   */
  section?: string;
  /** Hide below the `sm` breakpoint. The mobile card view shows it regardless. */
  hideOnMobile?: boolean;
  /** Shown in the mobile card's header line rather than its body. */
  primary?: boolean;
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'password'
  | 'tel'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'select'
  | 'checkbox'
  | 'file'
  | 'custom';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface FieldRenderProps<T extends BaseEntity> {
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  error?: string;
  disabled: boolean;
  /** Every current form value, for fields that depend on siblings. */
  values: Partial<T>;
}

export interface FieldConfig<T extends BaseEntity> {
  key: FieldKey<T>;
  label: string;
  type?: FieldType;
  placeholder?: string;
  help?: string;
  required?: boolean;
  disabled?: boolean;
  /** Editable on create, read-only on edit. For immutable identifiers. */
  createOnly?: boolean;
  /** Omitted from the create form. For server-assigned values. */
  editOnly?: boolean;

  /** Static options, or a loader for values fetched from the API. */
  options?: SelectOption[];
  loadOptions?: () => Promise<SelectOption[]>;

  /** `type: 'custom'` only. The escape hatch that keeps the built-in list short. */
  render?: (props: FieldRenderProps<T>) => ReactNode;

  /** Show this field only when the form's current values satisfy a predicate. */
  visibleWhen?: (values: Partial<T>) => boolean;

  /** Grid columns to span, out of 2. Defaults to full width. */
  span?: 1 | 2;

  /** Groups fields under a heading. Fields sharing a `section` render together. */
  section?: string;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/**
 * Django field lookups.
 *
 * The value becomes `?field__lookup=value`, which is exactly what
 * `django-filter`'s `FilterSet` consumes — so a filter declared here needs no
 * bespoke backend endpoint, only the field listed in the viewset's
 * `filterset_fields`.
 *
 * `exact` is the default and is written without a suffix, because
 * `?status__exact=active` and `?status=active` mean the same thing to Django
 * and the shorter form is what people expect to see in a URL.
 */
export type FilterLookup =
  | 'exact'
  | 'iexact'
  | 'contains'
  | 'icontains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'isnull';

export interface FilterConfig<T extends BaseEntity> {
  key: FieldKey<T>;
  label: string;
  /**
   * `select` renders a dropdown, `boolean` a yes/no/any tri-state, `date` a
   * date input, `text` a free-text box.
   *
   * There is deliberately no `date-range` type. A range is two filters —
   * `{ key: 'created_at', lookup: 'gte' }` and `{ key: 'created_at', lookup:
   * 'lte' }` — which composes without a special case and lets you label each
   * end ("From" / "Until") in your own words.
   */
  type: 'select' | 'boolean' | 'date' | 'text';
  lookup?: FilterLookup;
  options?: SelectOption[];
  loadOptions?: () => Promise<SelectOption[]>;
  placeholder?: string;
}

/** The query-parameter name a filter writes: `status`, or `price__gte`. */
export function filterParamName<T extends BaseEntity>(filter: FilterConfig<T>): string {
  const lookup = filter.lookup ?? 'exact';
  return lookup === 'exact' ? String(filter.key) : `${String(filter.key)}__${lookup}`;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface RowAction<T extends BaseEntity> {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Return value is ignored, so a mutation's promise can be passed straight in. */
  onSelect: (row: T) => unknown;
  /** Hide entirely for rows where this returns false. */
  visible?: (row: T) => boolean;
  /** Render but disable. Prefer this over hiding when the user could fix it. */
  disabled?: (row: T) => boolean;
  /** Show a confirmation prompt with this message first. */
  confirm?: string | ((row: T) => string);
  tone?: 'default' | 'danger';
}

export interface BulkAction<T extends BaseEntity> {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Return value is ignored, so a mutation's promise can be passed straight in. */
  onSelect: (rows: T[]) => unknown;
  confirm?: string | ((rows: T[]) => string);
  tone?: 'default' | 'danger';
}

// ---------------------------------------------------------------------------
// The config
// ---------------------------------------------------------------------------

/**
 * Everything the entity components need.
 *
 * Only `name`, `columns` and `fields` are required, and each is required only
 * by the component that uses it — `<EntityForm>` never reads `columns`. The
 * source project made a create-only screen declare
 * `list: { columns: [] }, view: { fields: [] }, actions: { actions: [] }`
 * because its orchestrator demanded the full object. Components here take
 * what they need.
 */
export interface EntityConfig<T extends BaseEntity> {
  /** Singular display name, e.g. "Product". */
  name: string;
  /** Plural. Defaults to `name + "s"`, which is wrong often enough to set. */
  namePlural?: string;

  columns?: ColumnConfig<T>[];
  fields?: FieldConfig<T>[];
  /** Detail-view fields. Falls back to `columns` when omitted. */
  detail?: ColumnConfig<T>[];

  rowActions?: RowAction<T>[];
  /**
   * Row actions shown as buttons before the rest collapse into an overflow
   * menu. Defaults to 1. Raise it when the actions are the point of the
   * table; lower it on a narrow layout.
   */
  inlineActionCount?: number;
  bulkActions?: BulkAction<T>[];

  /** Faceted filters shown above the list. Each maps to a Django lookup. */
  filters?: FilterConfig<T>[];

  /** Default `?ordering=` value. Prefix with `-` for descending. */
  defaultSort?: string;
  pageSize?: number;

  searchable?: boolean;
  searchPlaceholder?: string;

  /** Show the checkbox column. Implied by any `bulkActions`. */
  selectable?: boolean;

  /**
   * Show an export control. Requires `export_fields` on the Django viewset —
   * that server-side allowlist is the actual control over what leaves the
   * system, not anything declared here.
   *
   * To let users export a subset, pass `fields` through the export call's
   * query params; the backend rejects anything outside its allowlist:
   *
   *     onExport={(format) =>
   *       products.exportRows({ ...controller.queryParams, fields: 'sku,name' }, format)
   *     }
   */
  exportable?: boolean;
  /** Formats offered. Defaults to CSV only; add 'xlsx' if openpyxl is installed. */
  exportFormats?: Array<'csv' | 'xlsx'>;

  /** Show a Trash toggle, switching the list to `?is_deleted=true`. */
  trashable?: boolean;

  /** Rendered when a list has no rows. */
  emptyMessage?: string;

  /** Row click behaviour. Omit for no click handling. */
  onRowClick?: (row: T) => void;
}

// ---------------------------------------------------------------------------
// List state
// ---------------------------------------------------------------------------

/** The state `useEntityList` owns and puts in the URL. */
export interface EntityListState {
  page: number;
  pageSize: number;
  search: string;
  ordering: string;
  /** `true` shows the trash view. Maps to the backend's `?is_deleted=`. */
  showDeleted: boolean;
  filters: Record<string, string | number | boolean>;
}

export type ViewMode = 'table' | 'cards';
