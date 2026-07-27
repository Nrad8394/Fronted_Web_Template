'use client';

/**
 * List state: pagination, search, sort, selection.
 *
 * Two things this does that the source project's equivalent did not.
 *
 * **State lives in the URL.** Page, search and ordering are query parameters,
 * so a filtered view is linkable, survives a refresh, and works with the
 * browser's back button. Holding them in `useState` — as the original did —
 * means a user who opens a row, hits back, and lands on page 1 of an unsorted
 * list has lost their place. That is the single most common complaint about
 * admin tables and it is free to avoid.
 *
 * **Search is debounced separately from the input.** The text box updates
 * immediately (so typing feels responsive) while the query parameter lags,
 * so a 12-character search issues one request rather than twelve.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { BaseEntity, EntityListState, FilterConfig } from './types';
import { filterParamName } from './types';

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export interface UseEntityListOptions<T extends BaseEntity = BaseEntity> {
  defaultSort?: string;
  pageSize?: number;
  /**
   * Filter definitions. Needed here as well as in the config because the hook
   * has to know which query parameters belong to it — anything else in the
   * URL is another component's business and must be left alone.
   */
  filters?: FilterConfig<T>[];
  /**
   * Prefix for query parameters. Set it when two lists share a page, or they
   * will fight over `?page=`.
   */
  paramPrefix?: string;
  /**
   * Keep state out of the URL. For a list inside a modal, where writing to
   * the address bar would be wrong.
   */
  ephemeral?: boolean;
}

export function useEntityList<T extends BaseEntity>(options: UseEntityListOptions<T> = {}) {
  const {
    defaultSort = '',
    pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
    paramPrefix = '',
    ephemeral = false,
    filters: filterConfigs = [],
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const key = useCallback((name: string) => `${paramPrefix}${name}`, [paramPrefix]);

  // --- Ephemeral fallback -------------------------------------------------
  // Kept in a ref-backed state object so the hook's public surface is
  // identical whether or not the URL is in play.
  const [localState, setLocalState] = useState<EntityListState>({
    page: 1,
    pageSize: initialPageSize,
    search: '',
    ordering: defaultSort,
    showDeleted: false,
    filters: {},
  });

  const urlState = useMemo<EntityListState>(
    () => ({
      page: Number(searchParams.get(key('page')) ?? 1) || 1,
      pageSize: Number(searchParams.get(key('size')) ?? initialPageSize) || initialPageSize,
      search: searchParams.get(key('q')) ?? '',
      ordering: searchParams.get(key('sort')) ?? defaultSort,
      showDeleted: searchParams.get(key('deleted')) === '1',
      filters: Object.fromEntries(
        filterConfigs
          .map((filter) => [filterParamName(filter), searchParams.get(key(filterParamName(filter)))])
          .filter((entry): entry is [string, string] => entry[1] !== null && entry[1] !== ''),
      ),
    }),
    [searchParams, key, initialPageSize, defaultSort, filterConfigs],
  );

  const state = ephemeral ? localState : urlState;

  // Immediate value for the input; `state.search` is the debounced one that
  // actually drives the request.
  const [searchInput, setSearchInput] = useState(state.search);

  const writeUrl = useCallback(
    (next: Partial<EntityListState>) => {
      if (ephemeral) {
        setLocalState((prev) => ({ ...prev, ...next }));
        return;
      }

      const params = new URLSearchParams(searchParams.toString());

      const set = (name: string, value: string | null) => {
        if (value === null || value === '') params.delete(key(name));
        else params.set(key(name), value);
      };

      if (next.page !== undefined) set('page', next.page > 1 ? String(next.page) : null);
      if (next.pageSize !== undefined) {
        set('size', next.pageSize === initialPageSize ? null : String(next.pageSize));
      }
      if (next.search !== undefined) set('q', next.search || null);
      if (next.ordering !== undefined) {
        set('sort', next.ordering === defaultSort ? null : next.ordering);
      }
      if (next.showDeleted !== undefined) set('deleted', next.showDeleted ? '1' : null);

      if (next.filters !== undefined) {
        // Every configured filter is rewritten, not merged, so clearing one
        // actually removes it from the URL. A merge would make a cleared
        // filter impossible to express.
        for (const filter of filterConfigs) {
          const paramName = filterParamName(filter);
          const value = next.filters[paramName];
          set(paramName, value === undefined || value === '' ? null : String(value));
        }
      }

      // `replace`, not `push`: typing in a search box should not create one
      // history entry per keystroke-batch. `scroll: false` keeps the viewport
      // still — re-sorting a table you have scrolled down should not jump you
      // back to the top.
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [ephemeral, searchParams, key, router, pathname, initialPageSize, defaultSort, filterConfigs],
  );

  // --- Debounced search ---------------------------------------------------
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFirstRun = useRef(true);

  useEffect(() => {
    // Skip the mount pass, or landing on a URL that already has `?q=` would
    // immediately rewrite the URL with the same value.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (searchInput === state.search) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Any search change resets to page 1 — staying on page 7 of a result
      // set that now has two pages shows an empty table.
      writeUrl({ search: searchInput, page: 1 });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [searchInput, state.search, writeUrl]);

  // Keep the input in step when the URL changes from elsewhere (back button,
  // a cleared-filters button).
  useEffect(() => {
    setSearchInput(state.search);
  }, [state.search]);

  // --- Selection ----------------------------------------------------------
  // Ids rather than rows: a row object from page 1 is a stale snapshot by the
  // time the user is on page 3, and comparing object identity across refetches
  // silently drops selections.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelected = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const stringId = String(id);
      if (next.has(stringId)) next.delete(stringId);
      else next.add(stringId);
      return next;
    });
  }, []);

  const toggleAll = useCallback((rows: T[]) => {
    setSelectedIds((prev) => {
      const pageIds = rows.map((row) => String(row.id));
      const allSelected = pageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      // Only touches the current page, so selecting across pages accumulates
      // rather than being wiped by the header checkbox.
      for (const id of pageIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const isSelected = useCallback(
    (id: string | number) => selectedIds.has(String(id)),
    [selectedIds],
  );

  // --- Sorting ------------------------------------------------------------
  const toggleSort = useCallback(
    (field: string) => {
      const current = state.ordering;
      // Cycle: ascending -> descending -> off. The third state matters; with
      // only two you cannot get back to the server's default ordering.
      let next: string;
      if (current === field) next = `-${field}`;
      else if (current === `-${field}`) next = '';
      else next = field;

      writeUrl({ ordering: next, page: 1 });
    },
    [state.ordering, writeUrl],
  );

  const sortDirection = useCallback(
    (field: string): 'asc' | 'desc' | null => {
      if (state.ordering === field) return 'asc';
      if (state.ordering === `-${field}`) return 'desc';
      return null;
    },
    [state.ordering],
  );

  // --- Params for the API -------------------------------------------------
  const queryParams = useMemo(
    () => ({
      page: state.page,
      page_size: state.pageSize,
      search: state.search || undefined,
      ordering: state.ordering || undefined,
      is_deleted: state.showDeleted ? true : undefined,
      ...state.filters,
    }),
    [state],
  );

  return {
    state,
    queryParams,

    searchInput,
    setSearchInput,

    setPage: useCallback((page: number) => writeUrl({ page }), [writeUrl]),
    setPageSize: useCallback(
      (size: number) => writeUrl({ pageSize: size, page: 1 }),
      [writeUrl],
    ),
    /** Set one filter. Passing '' or undefined removes it. */
    setFilter: useCallback(
      (paramName: string, value: string | number | boolean | undefined) => {
        // Filtering resets to page 1 for the same reason searching does:
        // the result set changes size and the current page may not exist.
        writeUrl({
          filters: { ...state.filters, [paramName]: value as string },
          page: 1,
        });
      },
      [writeUrl, state.filters],
    ),

    clearFilters: useCallback(() => {
      writeUrl({ filters: {}, page: 1 });
    }, [writeUrl]),

    activeFilterCount: Object.values(state.filters).filter(
      (value) => value !== undefined && value !== '',
    ).length,

    setShowDeleted: useCallback(
      (showDeleted: boolean) => {
        clearSelection();
        writeUrl({ showDeleted, page: 1 });
      },
      [writeUrl, clearSelection],
    ),

    toggleSort,
    sortDirection,

    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggleSelected,
    toggleAll,
    clearSelection,
  };
}

export type EntityListController<T extends BaseEntity> = ReturnType<
  typeof useEntityList<T>
>;
