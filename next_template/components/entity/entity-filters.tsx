'use client';

/**
 * Filter controls for a list.
 *
 * Each control writes one query parameter named for its Django lookup
 * (`status`, `price__gte`), so the backend needs no bespoke endpoint — only
 * the field listed in the viewset's `filterset_fields`.
 *
 * Two decisions worth stating:
 *
 * **Filters apply immediately, with no Apply button.** The state is in the
 * URL, so an unwanted filter is undone with the back button. An Apply button
 * buys batching that matters only when a request is expensive; if yours is,
 * raise the debounce on the text filter rather than adding a button that has
 * to be pressed every time.
 *
 * **Booleans are tri-state.** "Any / Yes / No", not a checkbox. A checkbox
 * has two states but a boolean filter has three — unset, true, false — and
 * collapsing them means you can filter to "archived" but never back to
 * "not archived" without clearing everything.
 */

import { useEffect, useId, useState } from 'react';

import type { BaseEntity, FilterConfig, SelectOption } from '@/lib/entity/types';
import { filterParamName } from '@/lib/entity/types';
import type { EntityListController } from '@/lib/entity/use-entity-list';

interface EntityFiltersProps<T extends BaseEntity> {
  filters: FilterConfig<T>[];
  controller: EntityListController<T>;
}

export function EntityFilters<T extends BaseEntity>({
  filters,
  controller,
}: EntityFiltersProps<T>) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
      {filters.map((filter) => (
        <FilterControl
          key={filterParamName(filter)}
          filter={filter}
          controller={controller}
        />
      ))}

      {controller.activeFilterCount > 0 && (
        <button
          type="button"
          onClick={controller.clearFilters}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          Clear {controller.activeFilterCount} filter
          {controller.activeFilterCount === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
}

function FilterControl<T extends BaseEntity>({
  filter,
  controller,
}: {
  filter: FilterConfig<T>;
  controller: EntityListController<T>;
}) {
  const id = useId();
  const paramName = filterParamName(filter);
  const value = controller.state.filters[paramName] ?? '';

  const [asyncOptions, setAsyncOptions] = useState<SelectOption[] | null>(null);

  useEffect(() => {
    if (!filter.loadOptions) return;
    let cancelled = false;
    filter.loadOptions().then((options) => {
      if (!cancelled) setAsyncOptions(options);
    });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const options = asyncOptions ?? filter.options ?? [];

  const controlClass =
    'rounded-md border bg-transparent px-2 py-1.5 text-sm min-w-[8rem]';

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium opacity-70">
        {filter.label}
      </label>

      {filter.type === 'select' && (
        <select
          id={id}
          value={String(value)}
          onChange={(e) => controller.setFilter(paramName, e.target.value)}
          className={controlClass}
        >
          <option value="">{filter.placeholder ?? 'Any'}</option>
          {options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {filter.type === 'boolean' && (
        <select
          id={id}
          value={String(value)}
          onChange={(e) => controller.setFilter(paramName, e.target.value)}
          className={controlClass}
        >
          {/* Django's BooleanFilter parses the strings "true" and "false". */}
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      )}

      {filter.type === 'date' && (
        <input
          id={id}
          type="date"
          value={String(value)}
          onChange={(e) => controller.setFilter(paramName, e.target.value)}
          className={controlClass}
        />
      )}

      {filter.type === 'text' && (
        <TextFilter
          id={id}
          value={String(value)}
          placeholder={filter.placeholder}
          onCommit={(next) => controller.setFilter(paramName, next)}
          className={controlClass}
        />
      )}
    </div>
  );
}

/**
 * Free-text filter, debounced.
 *
 * Its own local state so typing stays responsive while the URL — and the
 * request — lag behind. Writing on every keystroke would issue one request
 * per character and push a history entry each time.
 */
function TextFilter({
  id,
  value,
  placeholder,
  onCommit,
  className,
}: {
  id: string;
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
  className: string;
}) {
  const [draft, setDraft] = useState(value);

  // Re-sync when the URL changes from elsewhere — the back button, or the
  // Clear filters button.
  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onCommit(draft), 300);
    return () => clearTimeout(timer);
  }, [draft, value, onCommit]);

  return (
    <input
      id={id}
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      className={className}
    />
  );
}
