# Next.js Starter Template

A Next.js 15 App Router frontend built to pair with the
[Django starter template](../django_starter_template) — same error contract,
same pagination shape, same bulk endpoints.

What it gives you that `create-next-app` does not: an API client that survives
being deployed, JWT auth that does not log users out under concurrency, and
one error path instead of a growing pile of special cases.

---

## Quick start

```bash
cd next_template
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. Point `NEXT_PUBLIC_API_URL` at your backend.

```bash
# Docker — one image, configured at run time
docker build -t myapp-web .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=https://api.example.com myapp-web
```

---

## Layout

```
next_template/
├── app/
│   ├── layout.tsx              # Server Component; loads runtime env + theme script
│   ├── page.tsx
│   ├── (auth)/                 # login, register, forgot-password, reset-password
│   └── (app)/dashboard/        # example authenticated page
├── components/
│   ├── providers.tsx           # every client provider, in order
│   ├── theme-provider.tsx      # light/dark without a flash
│   ├── auth/protected-route.tsx
│   ├── entity/                 # EntityList / EntityForm / EntityView
│   └── ui/field.tsx            # accessible labelled input
├── lib/
│   ├── entity/                 # config-driven CRUD — see ANALYSIS.md
│   │   ├── types.ts            # the ONE config type, generic over T
│   │   ├── use-entity-list.ts  # URL-backed list state
│   │   └── format.ts           # Intl-based value formatting
│   ├── env.ts                  # runtime configuration
│   ├── api/
│   │   ├── endpoints.ts        # relative paths — read the docstring
│   │   ├── client.ts           # axios, refresh mutex, downloads, polling
│   │   ├── errors.ts           # one normalizer for every failure
│   │   ├── hooks.ts            # createResource() → typed react-query hooks
│   │   ├── types.ts            # Paginated<T>, ListParams, BaseEntity
│   │   └── query-client.ts
│   └── auth/
│       ├── token-store.ts      # in-memory access token; read this one
│       ├── auth-api.ts
│       ├── auth-context.tsx
│       └── types.ts
├── Dockerfile  docker-entrypoint.sh  .env.example
└── next.config.ts              # CSP and security headers
```

---

## The four decisions worth understanding

### 1. Configuration is resolved at runtime, not build time

Next.js inlines `NEXT_PUBLIC_*` into the bundle when you build. In a Docker
workflow that means one image per environment — you cannot promote a tested
artefact from staging to production, and changing an API URL means a rebuild.

`docker-entrypoint.sh` writes `public/env-config.js` at container start;
`app/layout.tsx` loads it `beforeInteractive`; `lib/env.ts` reads
`window.__ENV__` with a `process.env` fallback for SSR and `next dev`.

The accessors in `lib/env.ts` are **functions, not constants**, and that is
load-bearing: a module-level `const` captures its value on first import, which
can precede `env-config.js`, freezing the build-time fallback forever. The
failure is silent — correct in development, pointed at `localhost:8000` in
production.

### 2. Endpoints are relative paths

`lib/api/endpoints.ts` stores `/api/v1/auth/login/`, never
`` `${getApiUrl()}/api/v1/auth/login/` ``. The absolute form evaluates at
module load and hits exactly the problem above.

A real project that built absolute URLs ended up compensating inside its HTTP
client — an interceptor that parsed every outgoing URL and stripped the origin
back off if the path looked like one of its own. Building a URL and then
taking it apart again on every request is the symptom; relative paths plus
axios's `baseURL` (re-read per request) removes the cause.

### 3. The access token lives in memory

Not `localStorage`, not a JS-readable cookie. Both are reachable from any
injected script, so a single XSS — in your code or in a dependency —
exfiltrates a long-lived credential that keeps working from the attacker's
machine. The access token is a module variable; the refresh token is an
`HttpOnly` cookie the browser will not hand to JavaScript at all.

The honest cost: a page reload loses the access token, so the app calls
`/token/refresh/` on mount. One request, one brief loading state, handled in
`auth-context.tsx`. `token-store.ts` documents the fallback if your backend
cannot set an HttpOnly cookie.

### 4. There is exactly one error shape

The backend returns the same envelope for every failure.
`normalizeError(error)` turns anything — envelope, legacy DRF shape, network
failure, cancelled request — into:

```ts
{ type, message, fieldErrors: [{ field, code, message }], status, requestId, retryAfter }
```

so a form is:

```ts
try {
  await login({ email, password });
} catch (err) {
  const { message, fieldErrors } = normalizeError(err);
  setFieldErrors(fieldErrors);
  if (!fieldErrors.some((e) => e.field)) setFormError(message);
}
```

Field paths are dotted (`items.1.quantity`), which is already what
react-hook-form uses for nested arrays, so they map onto inputs with no
translation.

Without a contract this becomes a 150-line handler that walks unknown object
graphs. `lib/api/errors.ts` shows what one such handler was reduced to —
regex-matching Python's `ErrorDetail(string='…')` repr out of JSON.

---

## Entity screens

A filtered, sorted, paginated table with row actions, bulk actions, a
validated form and a detail view — from one typed config:

```tsx
const config: EntityConfig<Product> = {
  name: 'Product',
  searchable: true,
  columns: [
    { key: 'sku',    header: 'SKU',    sortable: true, primary: true },
    { key: 'price',  header: 'Price',  format: 'currency', align: 'right' },
    { key: 'status', header: 'Status', format: 'badge' },
  ],
  fields: [
    { key: 'sku',   label: 'SKU',   required: true, createOnly: true },
    { key: 'price', label: 'Price', type: 'currency', required: true },
  ],
  rowActions: [{ id: 'del', label: 'Delete', tone: 'danger',
                 confirm: (r) => `Delete ${r.name}?`, onSelect: remove }],
};

const controller = useEntityList<Product>({ defaultSort: '-created_at' });
const list = products.useList(controller.queryParams);

<EntityList config={config} controller={controller} data={list.data} />
```

`key` is `keyof Product`, so a typo is a compile error rather than an empty
table. `app/(app)/products/page.tsx` is a complete worked example.

Three things worth knowing:

- **List state lives in the URL.** Page, search and sort are query parameters,
  so a filtered view is linkable and the back button works.
- **`<EntityList>`, `<EntityForm>` and `<EntityView>` are independent.** A
  create-only screen declares only `fields`.
- **Forms are react-hook-form + zod.** Pass a `schema` for real rules; omit it
  and a minimal one is derived from `required`. Backend field errors attach to
  inputs automatically, because the error envelope's dotted paths are already
  react-hook-form's format.

`lib/entity/ANALYSIS.md` records why this is ~3,100 lines (including tests)
where the system it replaces was 21,892.

---

## Working with resources

```ts
// lib/api/resources/products.ts
import { createResource } from '@/lib/api/hooks';
import { Endpoints } from '@/lib/api/endpoints';

export const products = createResource<Product, ProductInput>(Endpoints.Products.List);
```

```tsx
const { data, isLoading } = products.useList({ page, search, ordering: '-created_at' });
const create = products.useCreate();
const update = products.useUpdate();
const bulkDelete = products.useBulkDelete();

await create.mutateAsync({ name, price });
await products.exportRows({ search }, 'xlsx');
```

`createResource` is a plain function — call it **at module scope**, once. The
pattern this replaces called its factory inside a component body, rebuilding
the closure on every render and making the returned identities unstable.

Cache keys are structured (`[url]`, `[url, 'list', params]`,
`[url, 'detail', id]`), so invalidating `[url]` clears every list and detail
for that resource and nothing belonging to another.

---

## Security notes

- **CSP is on** in `next.config.ts`, with each directive explained. It still
  needs `'unsafe-inline'` for scripts because Next.js injects inline bootstrap
  code; moving to a nonce-based policy via middleware is the meaningful
  upgrade.
- **HSTS is off** behind `ENABLE_HSTS`. Browsers cache it for the full
  `max-age` and it cannot be revoked from the server — enable it only once
  every subdomain is HTTPS-only, and ramp the value.
- **`ProtectedRoute` is not security.** It hides UI. Anyone can disable
  JavaScript. The backend's permission check on every endpoint is the actual
  boundary.
- **Redirect targets are validated.** `?next=` is only followed when it starts
  with a single `/`. Accepting an absolute URL there is an open redirect that
  looks like your own login link.
- **`NEXT_PUBLIC_` means public.** It is inlined into a bundle served to every
  visitor.

---

## Pairing with the Django template

| Frontend | Backend |
|---|---|
| `normalizeError()` | `apps/core/exceptions.py` |
| `Paginated<T>` | `apps/core/pagination.py` |
| `createResource()` bulk hooks | `apps/core/viewsets.BaseModelViewSet` |
| `ListParams.is_deleted` / `show_deleted` | `SoftDeleteQueryMixin` |
| `BaseEntity.created_by_email` | audit annotations in `get_queryset()` |

Each pair is a contract. Change one side and update the other in the same
commit, or the types quietly stop describing reality.

---

## Scripts

```bash
npm run dev          # Turbopack dev server
npm run build        # production build — run before pushing
npm run check        # lint + typecheck + test
npm run test:watch
```
