'use client';

/**
 * A data table with search, sort, pagination, selection and row actions.
 *
 * Roughly 400 lines against the source project's 2,296, because it carries
 * three view modes' worth of behaviour rather than eight, and delegates
 * formatting, state and data fetching to modules that already exist.
 *
 * Accessibility is not optional here and is easy to get wrong in a table:
 * sortable headers are real `<button>`s inside `<th scope="col">` and carry
 * `aria-sort`; the select-all checkbox exposes an indeterminate state; the
 * loading skeleton is `aria-busy` rather than a silent swap. None of it costs
 * layout.
 */

import { useId, useMemo } from 'react';

import type {
  BaseEntity,
  BulkAction,
  ColumnConfig,
  EntityConfig,
} from '@/lib/entity/types';
import { defaultTone, formatValue, readPath } from '@/lib/entity/format';
import type { EntityListController } from '@/lib/entity/use-entity-list';
import type { Paginated } from '@/lib/api/types';
import { EntityFilters } from './entity-filters';
import { ActionMenu } from './action-menu';

// Token-derived, not raw palette. Each tone is one semantic colour at 12%
// for the fill and full strength for the text, so a single set of classes
// works in both themes — the token itself already shifts between them.
const toneClass: Record<string, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-positive/12 text-positive',
  warning: 'bg-accent/15 text-accent',
  danger: 'bg-destructive/12 text-destructive',
  info: 'bg-primary/10 text-primary',
};

interface EntityListProps<T extends BaseEntity> {
  config: EntityConfig<T>;
  controller: EntityListController<T>;
  data?: Paginated<T>;
  isLoading?: boolean;
  error?: { message: string } | null;
  onRetry?: () => void;
  /** Wire to `resource.exportRows(controller.queryParams, format)`. */
  onExport?: (format: 'csv' | 'xlsx') => void | Promise<void>;
}

export function EntityList<T extends BaseEntity>({
  config,
  controller,
  data,
  isLoading,
  error,
  onRetry,
  onExport,
}: EntityListProps<T>) {
  const columns = config.columns ?? [];
  // Memoized because `?? []` builds a fresh array on every render, which would
  // make the selection memo below recompute each time and defeat its purpose.
  const rows = useMemo(() => data?.results ?? [], [data?.results]);
  const selectable = config.selectable || (config.bulkActions?.length ?? 0) > 0;

  const selectedRows = useMemo(
    () => rows.filter((row) => controller.isSelected(row.id)),
    [rows, controller],
  );

  if (error) {
    return (
      <div role="alert" className="rounded-md border border-destructive/40 p-6 text-center">
        <p className="text-sm text-destructive">{error.message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border px-3 py-1 text-sm"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Toolbar
        config={config}
        controller={controller}
        selectedRows={selectedRows}
        onExport={onExport}
      />

      {config.filters?.length ? (
        <EntityFilters filters={config.filters} controller={controller} />
      ) : null}

      {/* Desktop table. Hidden on small screens in favour of the cards below —
          a horizontally-scrolling data table on a phone is unusable, and
          `overflow-x: auto` alone just hides the problem.

          Both views are rendered and CSS picks one. The cost is duplicated
          DOM nodes; the alternative — a JS media-query hook that renders only
          one — costs a hydration mismatch (the server cannot know the
          viewport) and a flash of the wrong layout. Tailwind's `hidden` is
          `display: none`, which removes the inactive copy from the
          accessibility tree too, so nothing is announced twice. */}
      <div className="hidden overflow-x-auto rounded-md border sm:block">
        <table className="w-full text-sm" aria-busy={isLoading || undefined}>
          <caption className="sr-only">
            {config.namePlural ?? `${config.name}s`}
          </caption>
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-3 py-2">
                  <SelectAllCheckbox controller={controller} rows={rows} />
                </th>
              )}

              {columns.map((column) => (
                <HeaderCell
                  key={String(column.key)}
                  column={column}
                  controller={controller}
                />
              ))}

              {config.rowActions?.length ? (
                <th scope="col" className="w-10 px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {isLoading && rows.length === 0 ? (
              <SkeletonRows
                columns={columns.length + (selectable ? 1 : 0)}
                pageSize={controller.state.pageSize}
              />
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + 1}
                  className="px-3 py-10 text-center text-sm opacity-70"
                >
                  {config.emptyMessage ??
                    (controller.state.search
                      ? `No ${config.namePlural ?? 'results'} match “${controller.state.search}”.`
                      : `No ${config.namePlural ?? `${config.name}s`} yet.`)}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Row
                  key={String(row.id)}
                  row={row}
                  config={config}
                  controller={controller}
                  selectable={selectable}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 sm:hidden">
        {rows.map((row) => (
          <MobileCard key={String(row.id)} row={row} config={config} />
        ))}
        {!isLoading && rows.length === 0 && (
          <p className="py-10 text-center text-sm opacity-70">
            {config.emptyMessage ?? `No ${config.namePlural ?? `${config.name}s`} yet.`}
          </p>
        )}
      </div>

      <Pagination data={data} controller={controller} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Toolbar<T extends BaseEntity>({
  config,
  controller,
  selectedRows,
  onExport,
}: {
  config: EntityConfig<T>;
  controller: EntityListController<T>;
  selectedRows: T[];
  onExport?: (format: 'csv' | 'xlsx') => void | Promise<void>;
}) {
  const searchId = useId();
  const hasSelection = controller.selectedCount > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {config.searchable !== false && (
        <div className="min-w-[12rem] flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search {config.namePlural ?? config.name}
          </label>
          <input
            id={searchId}
            type="search"
            value={controller.searchInput}
            onChange={(e) => controller.setSearchInput(e.target.value)}
            placeholder={config.searchPlaceholder ?? 'Search…'}
            className="w-full rounded-md border bg-transparent px-3 py-1.5 text-sm"
          />
        </div>
      )}

      {hasSelection && config.bulkActions?.length ? (
        <div className="flex items-center gap-2">
          {/* Announced, because a selection count that only exists visually
              tells a screen-reader user nothing about why these buttons
              appeared. */}
          <span aria-live="polite" className="text-sm opacity-70">
            {controller.selectedCount} selected
          </span>
          {config.bulkActions.map((action) => (
            <BulkActionButton
              key={action.id}
              action={action}
              rows={selectedRows}
              onDone={controller.clearSelection}
            />
          ))}
          <button
            type="button"
            onClick={controller.clearSelection}
            className="rounded-md border px-2 py-1 text-sm"
          >
            Clear
          </button>
        </div>
      ) : null}

      {config.exportable &&
        onExport &&
        (config.exportFormats ?? ['csv']).map((format) => (
          <button
            key={format}
            type="button"
            onClick={() => onExport(format)}
            className="rounded-md border px-2 py-1.5 text-sm"
          >
            Export {format.toUpperCase()}
          </button>
        ))}

      {config.trashable && (
        // A trash view is a filter, not a separate page: it keeps the same
        // columns, search and sort, and the backend serves it from the same
        // endpoint via ?is_deleted=true.
        <button
          type="button"
          aria-pressed={controller.state.showDeleted}
          onClick={() => controller.setShowDeleted(!controller.state.showDeleted)}
          className={[
            'rounded-md border px-2 py-1.5 text-sm',
            controller.state.showDeleted ? 'bg-muted' : '',
          ].join(' ')}
        >
          {controller.state.showDeleted ? 'Showing trash' : 'Trash'}
        </button>
      )}
    </div>
  );
}

function BulkActionButton<T extends BaseEntity>({
  action,
  rows,
  onDone,
}: {
  action: BulkAction<T>;
  rows: T[];
  onDone: () => void;
}) {
  return (
    <button
      type="button"
      onClick={async () => {
        const message =
          typeof action.confirm === 'function' ? action.confirm(rows) : action.confirm;
        // `confirm()` blocks the main thread and cannot be styled. It is here
        // so the template has no dialog dependency — swap it for your own
        // modal; the shape of this call is what matters.
        if (message && !window.confirm(message)) return;
        await action.onSelect(rows);
        onDone();
      }}
      className={[
        'rounded-md border px-2 py-1 text-sm',
        action.tone === 'danger' ? 'border-destructive/40 text-destructive' : '',
      ].join(' ')}
    >
      {action.label}
    </button>
  );
}

function SelectAllCheckbox<T extends BaseEntity>({
  controller,
  rows,
}: {
  controller: EntityListController<T>;
  rows: T[];
}) {
  const allSelected = rows.length > 0 && rows.every((row) => controller.isSelected(row.id));
  const someSelected = rows.some((row) => controller.isSelected(row.id));

  return (
    <input
      type="checkbox"
      checked={allSelected}
      // `indeterminate` is a DOM property with no HTML attribute, so it has to
      // be set through a ref. Without it, "some rows selected" renders
      // identically to "none selected".
      ref={(node) => {
        if (node) node.indeterminate = !allSelected && someSelected;
      }}
      onChange={() => controller.toggleAll(rows)}
      aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
      className="h-4 w-4"
    />
  );
}

function HeaderCell<T extends BaseEntity>({
  column,
  controller,
}: {
  column: ColumnConfig<T>;
  controller: EntityListController<T>;
}) {
  const direction = column.sortable ? controller.sortDirection(String(column.key)) : null;

  return (
    <th
      scope="col"
      style={{ width: column.width }}
      // aria-sort is what tells assistive tech the table is sorted and how.
      // A visual arrow alone does not.
      aria-sort={
        direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined
      }
      className={[
        'px-3 py-2 font-medium',
        column.align === 'right' ? 'text-right' : '',
        column.align === 'center' ? 'text-center' : '',
        column.hideOnMobile ? 'hidden md:table-cell' : '',
      ].join(' ')}
    >
      {column.sortable ? (
        <button
          type="button"
          onClick={() => controller.toggleSort(String(column.key))}
          className="inline-flex items-center gap-1 hover:underline"
        >
          {column.header}
          <span aria-hidden="true" className="opacity-50">
            {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '↕'}
          </span>
        </button>
      ) : (
        column.header
      )}
    </th>
  );
}

function Cell<T extends BaseEntity>({ row, column }: { row: T; column: ColumnConfig<T> }) {
  if (column.render) return <>{column.render(row)}</>;

  const value = readPath(row, String(column.key));

  if (column.format === 'badge') {
    const tone = column.tone ? column.tone(value, row) : defaultTone(value);
    return (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}
      >
        {String(value ?? '—')}
      </span>
    );
  }

  if (column.format === 'email' && value) {
    return (
      <a href={`mailto:${String(value)}`} className="underline">
        {String(value)}
      </a>
    );
  }

  if (column.format === 'image' && value) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={String(value)} alt="" className="h-8 w-8 rounded object-cover" />;
  }

  return <>{formatValue(value, column.format)}</>;
}

function Row<T extends BaseEntity>({
  row,
  config,
  controller,
  selectable,
}: {
  row: T;
  config: EntityConfig<T>;
  controller: EntityListController<T>;
  selectable: boolean;
}) {
  const clickable = Boolean(config.onRowClick);

  return (
    <tr
      className={[
        'border-b last:border-0',
        clickable ? 'cursor-pointer hover:bg-muted/50' : '',
      ].join(' ')}
      onClick={clickable ? () => config.onRowClick?.(row) : undefined}
    >
      {selectable && (
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={controller.isSelected(row.id)}
            onChange={() => controller.toggleSelected(row.id)}
            aria-label={`Select row ${row.id}`}
            className="h-4 w-4"
          />
        </td>
      )}

      {(config.columns ?? []).map((column) => (
        <td
          key={String(column.key)}
          className={[
            'px-3 py-2',
            column.align === 'right' ? 'text-right' : '',
            column.align === 'center' ? 'text-center' : '',
            column.hideOnMobile ? 'hidden md:table-cell' : '',
          ].join(' ')}
        >
          <Cell row={row} column={column} />
        </td>
      ))}

      {config.rowActions?.length ? (
        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
          <ActionMenu
            actions={config.rowActions}
            row={row}
            inlineCount={config.inlineActionCount ?? 1}
          />
        </td>
      ) : null}
    </tr>
  );
}

function MobileCard<T extends BaseEntity>({
  row,
  config,
}: {
  row: T;
  config: EntityConfig<T>;
}) {
  const columns = config.columns ?? [];
  // `primary` columns form the card's title line; everything else becomes a
  // label/value pair. Falling back to the first column means a config that
  // never sets `primary` still produces a sensible card.
  const primary = columns.filter((c) => c.primary);
  const heading = primary.length ? primary : columns.slice(0, 1);
  const body = columns.filter((c) => !heading.includes(c));

  return (
    <button
      type="button"
      onClick={config.onRowClick ? () => config.onRowClick?.(row) : undefined}
      className="w-full rounded-md border p-3 text-left"
    >
      <div className="mb-2 font-medium">
        {heading.map((column) => (
          <Cell key={String(column.key)} row={row} column={column} />
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        {body.map((column) => (
          <div key={String(column.key)} className="contents">
            <dt className="opacity-60">{column.header}</dt>
            <dd className="text-right">
              <Cell row={row} column={column} />
            </dd>
          </div>
        ))}
      </dl>
    </button>
  );
}

function SkeletonRows({ columns, pageSize }: { columns: number; pageSize: number }) {
  // Matches the page size so the table does not resize when data arrives —
  // a skeleton of the wrong height causes a layout shift, which is worse than
  // no skeleton.
  return (
    <>
      {Array.from({ length: Math.min(pageSize, 8) }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b last:border-0">
          {Array.from({ length: columns + 1 }).map((__, cellIndex) => (
            <td key={cellIndex} className="px-3 py-3">
              <div className="h-3 animate-pulse rounded bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Pagination<T extends BaseEntity>({
  data,
  controller,
}: {
  data?: Paginated<T>;
  controller: EntityListController<T>;
}) {
  if (!data || data.total_pages <= 1) return null;

  const { current_page, total_pages, count } = data;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-2 text-sm"
    >
      <p className="opacity-70">
        Page {current_page} of {total_pages} · {count} total
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={current_page <= 1}
          onClick={() => controller.setPage(current_page - 1)}
          className="rounded-md border px-3 py-1 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={current_page >= total_pages}
          onClick={() => controller.setPage(current_page + 1)}
          className="rounded-md border px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
