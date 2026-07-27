'use client';

/**
 * Worked example — delete this route once you have your own.
 *
 * It is here as the executable answer to "how much do I have to write to get
 * a working admin screen", and as a regression test: it exercises typed
 * columns, formatters, badges, row and bulk actions, the form with a zod
 * schema, and the detail view. If the entity layer breaks, this stops
 * compiling.
 *
 * Everything below is configuration only. The equivalent in the source
 * project was a similar amount of config on top of 21,892 lines of framework;
 * this sits on about 3,100, tests included.
 */

import { useState } from 'react';
import { z } from 'zod';

import { EntityForm, EntityList, EntityView, useEntityList } from '@/components/entity';
import type { EntityConfig } from '@/components/entity';
import { createResource } from '@/lib/api/hooks';
import { Endpoints } from '@/lib/api/endpoints';
import { ProtectedRoute } from '@/components/auth/protected-route';

// --- The entity ------------------------------------------------------------

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  status: 'draft' | 'active' | 'archived';
  stock: number;
  created_at: string;
  [key: string]: unknown;
}

const products = createResource<Product>(Endpoints.Example.List);

// --- Validation ------------------------------------------------------------
// Passing a schema rather than relying on the derived fallback: `price` has a
// real rule (non-negative) that presence-checking cannot express.
const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required.').max(32),
  name: z.string().min(1, 'Name is required.'),
  price: z.coerce.number().nonnegative('Price cannot be negative.'),
  stock: z.coerce.number().int('Stock must be a whole number.').nonnegative(),
  status: z.enum(['draft', 'active', 'archived']),
});

// --- Config ----------------------------------------------------------------
// `key` is `keyof Product`, so a typo here is a compile error.

const productFilters: EntityConfig<Product>['filters'] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'active', label: 'Active' },
      { value: 'archived', label: 'Archived' },
    ],
  },
  // A range is two filters, not a special type — and each end gets a label
  // in your own words.
  { key: 'price', label: 'Min price', type: 'text', lookup: 'gte' },
  { key: 'price', label: 'Max price', type: 'text', lookup: 'lte' },
];

function buildConfig(onView: (p: Product) => void, onDelete: (p: Product) => void) {
  const config: EntityConfig<Product> = {
    name: 'Product',
    namePlural: 'Products',

    searchable: true,
    searchPlaceholder: 'Search by name or SKU…',
    defaultSort: '-created_at',
    selectable: true,
    exportable: true,
    exportFormats: ['csv', 'xlsx'],
    trashable: true,

    filters: productFilters,

    columns: [
      { key: 'sku', header: 'SKU', sortable: true, primary: true },
      { key: 'name', header: 'Name', sortable: true, primary: true },
      { key: 'price', header: 'Price', format: 'currency', align: 'right', sortable: true },
      { key: 'stock', header: 'Stock', format: 'number', align: 'right' },
      { key: 'status', header: 'Status', format: 'badge' },
      {
        key: 'created_at',
        header: 'Created',
        format: 'relative',
        sortable: true,
        hideOnMobile: true,
      },
    ],

    // Detail view fields, grouped into headed sections. `columns` would be
    // used verbatim if this were omitted.
    detail: [
      { key: 'sku', header: 'SKU', section: 'Identity' },
      { key: 'name', header: 'Name', section: 'Identity', span: 2 },
      { key: 'status', header: 'Status', format: 'badge', section: 'Identity' },
      { key: 'price', header: 'Price', format: 'currency', section: 'Commercials' },
      { key: 'stock', header: 'Stock on hand', format: 'number', section: 'Commercials' },
      { key: 'created_at', header: 'Created', format: 'datetime', section: 'Record' },
    ],

    fields: [
      { key: 'sku', label: 'SKU', required: true, createOnly: true, span: 1,
        help: 'Cannot be changed after creation.' },
      { key: 'name', label: 'Name', required: true, span: 1 },
      { key: 'price', label: 'Price', type: 'currency', required: true, span: 1 },
      { key: 'stock', label: 'Stock on hand', type: 'number', required: true, span: 1 },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'active', label: 'Active' },
          { value: 'archived', label: 'Archived' },
        ],
      },
    ],

    // Four actions: the first renders inline, the rest collapse into an
    // accessible overflow menu. Raise `inlineActionCount` to show more.
    inlineActionCount: 1,
    rowActions: [
      { id: 'view', label: 'View', onSelect: onView },
      { id: 'duplicate', label: 'Duplicate', onSelect: (row) => console.info(row.sku) },
      {
        id: 'archive',
        label: 'Archive',
        visible: (row) => row.status !== 'archived',
        onSelect: (row) => console.info(row.sku),
      },
      {
        id: 'delete',
        label: 'Delete',
        tone: 'danger',
        confirm: (row) => `Delete ${row.name}? It moves to the trash.`,
        // Hidden rather than disabled: an archived product has no delete
        // path, so showing a greyed-out button just invites a support ticket.
        visible: (row) => row.status !== 'archived',
        onSelect: onDelete,
      },
    ],

    onRowClick: onView,
  };

  return config;
}

// --- Page ------------------------------------------------------------------

function ProductsScreen() {
  const [mode, setMode] = useState<'list' | 'create' | 'view'>('list');
  const [selected, setSelected] = useState<Product | null>(null);

  // `filters` is passed to the hook as well as the config: the hook needs to
  // know which query parameters are its own, so it leaves everything else in
  // the URL alone.
  const controller = useEntityList<Product>({
    defaultSort: '-created_at',
    filters: productFilters,
  });
  const list = products.useList(controller.queryParams);
  const create = products.useCreate();
  const remove = products.useDelete();
  const bulkDelete = products.useBulkDelete();

  const config = buildConfig(
    (product) => {
      setSelected(product);
      setMode('view');
    },
    (product) => remove.mutateAsync(product.id),
  );

  config.bulkActions = [
    {
      id: 'bulk-delete',
      label: 'Delete selected',
      tone: 'danger',
      confirm: (rows) => `Delete ${rows.length} product(s)?`,
      onSelect: (rows) => bulkDelete.mutateAsync(rows.map((r) => r.id)),
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {mode === 'create' ? 'New product' : mode === 'view' ? selected?.name : 'Products'}
        </h1>
        {mode === 'list' ? (
          <button
            type="button"
            onClick={() => setMode('create')}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            New product
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode('list')}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            Back to list
          </button>
        )}
      </header>

      {mode === 'list' && (
        <EntityList
          config={config}
          controller={controller}
          data={list.data}
          isLoading={list.isLoading}
          error={list.error ? { message: 'Could not load products.' } : null}
          onRetry={() => list.refetch()}
          onExport={(format) => products.exportRows(controller.queryParams, format)}
        />
      )}

      {mode === 'create' && (
        <EntityForm
          config={config}
          schema={productSchema}
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            setMode('list');
          }}
          onCancel={() => setMode('list')}
        />
      )}

      {mode === 'view' && selected && <EntityView config={config} entity={selected} />}
    </main>
  );
}

export default function ProductsPage() {
  return (
    <ProtectedRoute>
      <ProductsScreen />
    </ProtectedRoute>
  );
}
