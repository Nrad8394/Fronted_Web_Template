'use client';

/**
 * Typed react-query hooks for any resource served by `BaseModelViewSet`.
 *
 * One call builds the whole set:
 *
 *     const products = createResource<Product>(Endpoints.Example.List);
 *
 *     const { data, isLoading } = products.useList({ page, search });
 *     const { data: item }      = products.useDetail(id);
 *     const create              = products.useCreate();
 *     const update              = products.useUpdate();
 *     const remove              = products.useDelete();
 *
 * Design notes
 * ------------
 * **`createResource` is a plain function, not a hook.** Call it at module
 * scope, once per resource. The version this replaces called its factory
 * *inside* a component body — `createApiService(url)()` on every render —
 * which rebuilt the closure each time and made the returned identities
 * unstable. Anything depending on them re-ran continuously.
 *
 * **Cache keys are structured.** `[url]`, `[url, 'list', params]`,
 * `[url, 'detail', id]`. Because react-query matches keys by prefix,
 * invalidating `[url]` clears every list and detail for that resource in one
 * call, and nothing belonging to another. Flat string keys cannot express
 * that.
 *
 * **Mutations do not show toasts.** They throw; the caller decides. A hook
 * that both throws and displays produces two messages as soon as a caller
 * adds a `catch`, and makes per-call-site error UI impossible.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';

import { downloadFile, http } from './client';
import { maybeFormData } from './form-data';
import type {
  BulkImportResult,
  BulkResult,
  ListParams,
  Paginated,
  Statistics,
} from './types';
import { toQueryParams } from './types';

/** Cache keys for one resource. Prefix-matched by react-query. */
export const resourceKeys = {
  all: (url: string) => [url] as const,
  lists: (url: string) => [url, 'list'] as const,
  list: (url: string, params?: ListParams) => [url, 'list', params ?? {}] as const,
  details: (url: string) => [url, 'detail'] as const,
  detail: (url: string, id: string | number) => [url, 'detail', String(id)] as const,
  statistics: (url: string, params?: ListParams) =>
    [url, 'statistics', params ?? {}] as const,
};

function detailUrl(baseUrl: string, id: string | number): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${id}/`;
}

function actionUrl(baseUrl: string, action: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${action}/`;
}

/**
 * Build the hook set for one resource.
 *
 * @param baseUrl Relative list endpoint, e.g. `Endpoints.Example.List`.
 */
export function createResource<TEntity, TInput = Partial<TEntity>>(baseUrl: string) {
  /** Paginated list. */
  function useList(
    params?: ListParams,
    options?: Omit<UseQueryOptions<Paginated<TEntity>>, 'queryKey' | 'queryFn'>,
  ) {
    return useQuery<Paginated<TEntity>>({
      queryKey: resourceKeys.list(baseUrl, params),
      queryFn: () => http.get<Paginated<TEntity>>(baseUrl, { params: toQueryParams(params) }),
      // Keep showing the previous page while the next one loads. Without
      // this, paging through a table blanks the whole thing on every click.
      placeholderData: (previous) => previous,
      ...options,
    });
  }

  /** Single record. Disabled while `id` is falsy, so it is safe to call
   *  unconditionally from a route that may not have an id yet. */
  function useDetail(
    id: string | number | undefined | null,
    options?: Omit<UseQueryOptions<TEntity>, 'queryKey' | 'queryFn'>,
  ) {
    return useQuery<TEntity>({
      queryKey: resourceKeys.detail(baseUrl, id ?? ''),
      queryFn: () => http.get<TEntity>(detailUrl(baseUrl, id!)),
      enabled: Boolean(id),
      ...options,
    });
  }

  function useStatistics(params?: ListParams) {
    return useQuery<Statistics>({
      queryKey: resourceKeys.statistics(baseUrl, params),
      queryFn: () =>
        http.get<Statistics>(actionUrl(baseUrl, 'statistics'), {
          params: toQueryParams(params),
        }),
    });
  }

  /** Invalidate everything under this resource — lists, details, statistics. */
  function useInvalidate() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: resourceKeys.all(baseUrl) });
  }

  function useCreate(
    options?: UseMutationOptions<TEntity, unknown, TInput | FormData>,
  ) {
    const queryClient = useQueryClient();
    return useMutation<TEntity, unknown, TInput | FormData>({
      // maybeFormData converts automatically when the payload holds a File,
      // so a call site never has to know whether its form has an upload in
      // it. Note the deliberate absence of a Content-Type header: the
      // browser must set it so it can append the multipart boundary. Setting
      // 'multipart/form-data' by hand omits the boundary and the server
      // cannot parse the body — the most common file-upload failure there is.
      mutationFn: (payload) => http.post<TEntity>(baseUrl, maybeFormData(payload)),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: resourceKeys.all(baseUrl) }),
      ...options,
    });
  }

  function useUpdate(
    options?: UseMutationOptions<
      TEntity,
      unknown,
      { id: string | number; data: TInput | FormData }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation<TEntity, unknown, { id: string | number; data: TInput | FormData }>({
      // PATCH, not PUT. PUT is a full replacement: any field the form does
      // not send is cleared. Almost every "the form wiped my other fields"
      // bug is a PUT that should have been a PATCH.
      mutationFn: ({ id, data }) =>
        http.patch<TEntity>(detailUrl(baseUrl, id), maybeFormData(data)),
      onSuccess: (_result, variables) => {
        queryClient.invalidateQueries({ queryKey: resourceKeys.lists(baseUrl) });
        queryClient.invalidateQueries({
          queryKey: resourceKeys.detail(baseUrl, variables.id),
        });
      },
      ...options,
    });
  }

  function useDelete(options?: UseMutationOptions<void, unknown, string | number>) {
    const queryClient = useQueryClient();
    return useMutation<void, unknown, string | number>({
      mutationFn: (id) => http.delete(detailUrl(baseUrl, id)),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: resourceKeys.all(baseUrl) }),
      ...options,
    });
  }

  function useRestore(options?: UseMutationOptions<TEntity, unknown, string | number>) {
    const queryClient = useQueryClient();
    return useMutation<TEntity, unknown, string | number>({
      mutationFn: (id) => http.post<TEntity>(`${detailUrl(baseUrl, id)}restore/`),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: resourceKeys.all(baseUrl) }),
      ...options,
    });
  }

  // --- Bulk operations ----------------------------------------------------

  function useBulkDelete(options?: UseMutationOptions<BulkResult, unknown, Array<string | number>>) {
    const queryClient = useQueryClient();
    return useMutation<BulkResult, unknown, Array<string | number>>({
      mutationFn: (ids) => http.post<BulkResult>(actionUrl(baseUrl, 'bulk_delete'), { ids }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: resourceKeys.all(baseUrl) }),
      ...options,
    });
  }

  function useBulkRestore(
    options?: UseMutationOptions<BulkResult, unknown, Array<string | number>>,
  ) {
    const queryClient = useQueryClient();
    return useMutation<BulkResult, unknown, Array<string | number>>({
      mutationFn: (ids) => http.post<BulkResult>(actionUrl(baseUrl, 'bulk_restore'), { ids }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: resourceKeys.all(baseUrl) }),
      ...options,
    });
  }

  function useBulkUpdate(
    options?: UseMutationOptions<
      { count: number; objects: TEntity[] },
      unknown,
      Array<{ id: string | number; data: Partial<TInput> }>
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      // The backend accepts only this per-object form. There is deliberately
      // no "apply one patch to N ids" variant — see the note in
      // `apps/core/bulk_serializers.py`; that shape bypasses validation
      // entirely.
      mutationFn: (updates: Array<{ id: string | number; data: Partial<TInput> }>) =>
        http.post<{ count: number; objects: TEntity[] }>(
          actionUrl(baseUrl, 'bulk_update'),
          { updates },
        ),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: resourceKeys.all(baseUrl) }),
      ...options,
    });
  }

  function useBulkImport(options?: UseMutationOptions<BulkImportResult, unknown, File>) {
    const queryClient = useQueryClient();
    return useMutation<BulkImportResult, unknown, File>({
      mutationFn: (file) => {
        const form = new FormData();
        form.append('file', file);
        return http.post<BulkImportResult>(actionUrl(baseUrl, 'bulk_import'), form);
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: resourceKeys.all(baseUrl) }),
      ...options,
    });
  }

  /**
   * Trigger a file download of the current filter's rows.
   *
   * Not a react-query mutation: the result is a browser download, not
   * something to cache or re-render from.
   *
   * The backend caps the row count and reports truncation in the
   * `X-Export-Truncated` header. Surface that — a silently truncated export
   * looks like a complete one and people reconcile against it.
   */
  async function exportRows(
    params?: ListParams,
    format: 'csv' | 'xlsx' = 'csv',
  ): Promise<void> {
    await downloadFile(
      actionUrl(baseUrl, 'bulk_export'),
      `export.${format}`,
      { params: { ...toQueryParams(params), file_format: format } },
    );
  }

  async function downloadImportTemplate(format: 'csv' | 'xlsx' = 'csv'): Promise<void> {
    await downloadFile(
      actionUrl(baseUrl, 'bulk_import_template'),
      `import-template.${format}`,
      { params: { file_format: format } },
    );
  }

  return {
    baseUrl,
    keys: {
      all: () => resourceKeys.all(baseUrl),
      lists: () => resourceKeys.lists(baseUrl),
      list: (params?: ListParams) => resourceKeys.list(baseUrl, params),
      detail: (id: string | number) => resourceKeys.detail(baseUrl, id),
    },
    useList,
    useDetail,
    useStatistics,
    useInvalidate,
    useCreate,
    useUpdate,
    useDelete,
    useRestore,
    useBulkDelete,
    useBulkRestore,
    useBulkUpdate,
    useBulkImport,
    exportRows,
    downloadImportTemplate,
  };
}

export type Resource<TEntity, TInput = Partial<TEntity>> = ReturnType<
  typeof createResource<TEntity, TInput>
>;
