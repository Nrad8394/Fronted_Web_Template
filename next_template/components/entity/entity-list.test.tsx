import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EntityList } from './entity-list';
import type { EntityConfig } from '@/lib/entity/types';
import type { EntityListController } from '@/lib/entity/use-entity-list';
import type { Paginated } from '@/lib/api/types';

/**
 * These tests pin the accessibility contract, not the styling.
 *
 * A data table is one of the easiest components to make unusable without
 * noticing: the visual sort arrow works fine while `aria-sort` is missing,
 * and a select-all checkbox looks correct while its indeterminate state never
 * renders. Both are invisible to the person writing the CSS and blocking for
 * the person using a screen reader, so they get assertions.
 */

interface Row {
  id: string;
  name: string;
  price: number;
  status: string;
  [key: string]: unknown;
}

const rows: Row[] = [
  { id: '1', name: 'Widget', price: 10, status: 'active' },
  { id: '2', name: 'Gadget', price: 0, status: 'pending' },
];

const page: Paginated<Row> = {
  count: 2,
  next: null,
  previous: null,
  page_size: 20,
  total_pages: 1,
  current_page: 1,
  results: rows,
};

function makeController(over: Partial<EntityListController<Row>> = {}) {
  return {
    state: {
      page: 1,
      pageSize: 20,
      search: '',
      ordering: '',
      showDeleted: false,
      filters: {},
    },
    queryParams: {},
    searchInput: '',
    setSearchInput: vi.fn(),
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setFilter: vi.fn(),
    clearFilters: vi.fn(),
    activeFilterCount: 0,
    setShowDeleted: vi.fn(),
    toggleSort: vi.fn(),
    sortDirection: () => null,
    selectedIds: new Set<string>(),
    selectedCount: 0,
    isSelected: () => false,
    toggleSelected: vi.fn(),
    toggleAll: vi.fn(),
    clearSelection: vi.fn(),
    ...over,
  } as unknown as EntityListController<Row>;
}

const config: EntityConfig<Row> = {
  name: 'Product',
  namePlural: 'Products',
  columns: [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'price', header: 'Price', format: 'currency' },
    { key: 'status', header: 'Status', format: 'badge' },
  ],
};

describe('EntityList', () => {
  it('renders rows with formatted values', () => {
    render(<EntityList config={config} controller={makeController()} data={page} />);

    // Scoped to the table: the component renders the desktop table AND the
    // mobile cards, relying on CSS to show one. jsdom applies no CSS, so an
    // unscoped getByText finds both copies. Scoping is also more precise —
    // it asserts the table specifically renders this.
    const table = within(screen.getByRole('table'));

    expect(table.getByText('Widget')).toBeInTheDocument();
    expect(table.getByText('$10.00')).toBeInTheDocument();
    // Zero must render as a price, not as the em-dash placeholder.
    expect(table.getByText('$0.00')).toBeInTheDocument();
  });

  it('exposes sort state via aria-sort, not just an arrow', () => {
    const controller = makeController({
      sortDirection: ((field: string) =>
        field === 'name' ? 'asc' : null) as EntityListController<Row>['sortDirection'],
    });

    render(<EntityList config={config} controller={controller} data={page} />);

    expect(screen.getByRole('columnheader', { name: /name/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    // A non-sorted column must not claim a sort state.
    expect(screen.getByRole('columnheader', { name: /price/i })).not.toHaveAttribute(
      'aria-sort',
    );
  });

  it('sorts through a real button, so it is keyboard reachable', async () => {
    const toggleSort = vi.fn();
    const user = userEvent.setup();

    render(
      <EntityList config={config} controller={makeController({ toggleSort })} data={page} />,
    );

    // A click handler on a <th> would pass a visual test and be unreachable
    // by keyboard. Finding it by role proves it is a button.
    await user.click(screen.getByRole('button', { name: /name/i }));
    expect(toggleSort).toHaveBeenCalledWith('name');
  });

  it('marks the select-all checkbox indeterminate on a partial selection', () => {
    const controller = makeController({
      isSelected: ((id: string) => id === '1') as EntityListController<Row>['isSelected'],
      selectedCount: 1,
    });

    render(
      <EntityList
        config={{ ...config, selectable: true }}
        controller={controller}
        data={page}
      />,
    );

    const selectAll = screen.getByRole('checkbox', { name: /select all rows/i });
    // `indeterminate` is a DOM property with no HTML attribute — it can only
    // be set via a ref, which is exactly the step that gets forgotten.
    expect((selectAll as HTMLInputElement).indeterminate).toBe(true);
  });

  it('shows a search-aware empty message', () => {
    const controller = makeController();
    controller.state.search = 'zzz';

    render(
      <EntityList config={config} controller={controller} data={{ ...page, results: [], count: 0 }} />,
    );

    // "No results match X" tells the user their search is the reason.
    // "No products yet" would be a lie.
    expect(
      within(screen.getByRole('table')).getByText(/no products match/i),
    ).toBeInTheDocument();
  });

  it('renders an error with a retry affordance instead of an empty table', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(
      <EntityList
        config={config}
        controller={makeController()}
        error={{ message: 'Could not load products.' }}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load products.');
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('hides a row action when `visible` returns false', () => {
    const withActions: EntityConfig<Row> = {
      ...config,
      rowActions: [
        {
          id: 'del',
          label: 'Delete',
          onSelect: vi.fn(),
          visible: (row) => row.status !== 'pending',
        },
      ],
    };

    render(<EntityList config={withActions} controller={makeController()} data={page} />);

    // Row actions live in the table only, so this is already unambiguous.
    // Widget is active, Gadget is pending — so exactly one Delete button.
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
  });

  it('gives the table an accessible name', () => {
    render(<EntityList config={config} controller={makeController()} data={page} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Products')).toBeInTheDocument();
  });
});
