# entityManager: what it was for, and what the rewrite changes

The source project's `components/entityManager/` is **21,892 lines** of
implementation across ~70 files (24,190 with its own tests). This directory is
the reimplementation. The reasoning is here because the original solved a real
problem and the temptation is either to copy it wholesale or to dismiss it —
both wrong.

## What it was created for

A CRUD admin surface has a shape that repeats: a filtered, sorted, paginated
table; a create/edit form; a detail view; row and bulk actions; import and
export. Writing that by hand for 20 resources produces 20 slightly different
tables, 20 subtly different error behaviours, and 20 places to fix the same
pagination bug.

Declaring the resource once and generating all of it is the right instinct.
The source project's version genuinely works and carries real operational
knowledge — file-upload detection, Django filter-lookup syntax, mobile card
fallbacks, per-field re-render isolation. None of that is thrown away.

## What went wrong

Measured, not asserted. All counts are from the source project.

### The public API is four symbols; the implementation is 21,892 lines

Across 194 consuming files:

| Symbol | Imports |
|---|---|
| `EntityManager` | 90 |
| `createHttpClient` | 28 |
| type-only imports | ~40 |

Everything else is internal. That is not inherently bad — but it means the
surface that had to keep working was tiny, while the volume that had to be
maintained was not.

### Roughly 4,000 lines were never imported at all

| Module | Lines | Consumer imports |
|---|---|---|
| `EntityConfigBuilder` | 477 | 0 |
| `ActionBuilder` | 426 | 0 |
| `FieldBuilder` | 294 | 0 |
| `ColumnBuilder` | — | 0 |
| `EntityStateProvider` | 378 | 0 |
| `useEntityCache` | 315 | 0 |
| `EntityImporter` | 663 | 0 |
| `BulkActions` | 216 | 0 |
| `InlineEdit`, `useTouchGestures`, `useResponsiveView` | — | 0 |

The builder layer is the clearest case. A fluent
`EntityConfigBuilder().addColumn().addAction().build()` API was written,
documented, and never called once — every call site passes a plain object
literal. The builders exist because "config objects are hard to type"; the
actual fix for that is to type the config object, which costs nothing at
runtime.

### Three parallel config type systems, one of which shadows a directory

- `primitives/types/config.ts` — `DisplayConfig`, `ListConfig` with
  `singular`, `searchEnabled`, `defaultPageSize`
- `primitives/types.ts` — a **file next to the `primitives/types/`
  directory**, defining another `ListConfig`. Python's package-shadows-module
  problem, in TypeScript.
- `composition/config/types.ts` — the one actually used, derived from
  `EntityListProps`, spelling the same concepts `label`, `searchable`,
  `pageSize`.

A consumer reading `primitives/types/config.ts` — the file that looks
canonical — would write a config the orchestrator does not accept.

### The entry point disabled type checking

```ts
export interface EntityManagerProps<T extends BaseEntity = BaseEntity> {
  // Accept either canonical config or legacy/compact shapes during migration
  config: EntityManagerConfig<T> | Record<string, unknown>;
}
```

`Record<string, unknown>` at the single most important boundary means all 90
call sites are unchecked. A mistyped key is not a compile error.

### So the library guesses at runtime

```ts
const list = entity.list ?? entity.columns ?? entity.listConfig ?? entity.listColumns;
const view = entity.view ?? entity.viewFields ?? entity.viewConfig;
const actions = entity.actions ?? entity.actionConfig ?? {};
normalizedEntity.form = entity.form ?? { fields: entity.fields ?? [] };
```

Four accepted spellings of one key. This is the same failure as the API error
contract (`PATTERNS.md` §1) with the direction reversed: there, six response
shapes forced the client to guess; here, no committed config shape forces the
*library* to guess what the consumer meant.

The cost is not the ~100 lines of normalizer. It is that `listColumn`
(singular, a typo) silently renders an empty table, with no error, at runtime,
in production.

### Most of the configurable surface was never configured

| Feature | Defined | Used |
|---|---|---|
| View modes | 8 (`table card grid list compact timeline detailed gallery`) | 3 (`table` 8×, `gallery` 2×, `card` 1×) |
| Form layouts | 5 | 3 (`tabs` 5×, `vertical` 2×, `grid` 1×) |
| Field types | 33 | ~18 |

`components/list/index.tsx` is 2,296 lines, carrying five view modes nobody
asked for.

### The form reimplements dependencies the project already had

`components/form/index.tsx` (1,507 lines) hand-rolls form state — `useState`,
a `FormState` object, manual `touched`/`errors` bookkeeping — and
`primitives/utils/validation.ts` (246 lines) hand-rolls a validation rule DSL.

`react-hook-form` and `zod` were already in `package.json`.

The form file's own header documents three bugs it had to fix:

1. missing `autoComplete`/`name` attributes on inputs
2. clicks inside nested components bubbling into an accidental submit
3. a `useMemo` keyed on the whole `values` object, re-rendering every field
   whenever any field changed

All three are solved by construction in react-hook-form: it registers native
inputs (so autocomplete works), and it is uncontrolled by default (so #3
cannot happen).

## What the rewrite keeps

Everything that was real operational knowledge:

- **Automatic `FormData` conversion** when a payload contains a `File`, with
  the `Content-Type` left unset so the browser supplies the multipart
  boundary. (`lib/api/form-data.ts`, wired into `createResource`'s create and
  update mutations.)
- **Django filter-lookup syntax** (`price__gte`) — `FilterConfig` declares a
  `lookup` and the control writes `?field__lookup=value`, which
  `django-filter` consumes directly.
- **Mobile card fallback** for tables — a data table is unusable on a phone.
- **Per-field re-render isolation** — obtained free from react-hook-form.
- **`custom` field and column renderers** — 20 call sites use `custom`, and it
  is what makes 12 built-in field types sufficient where 33 were not.
- **Server-driven pagination, search, ordering** matching the Django
  template's `BaseModelViewSet`.

## What the rewrite changes

1. **One config type, generic over the entity.** Column and field keys are
   `keyof T`, so a typo is a compile error rather than an empty table. No
   normalizer, no alternate spellings.
2. **Composable, not monolithic.** `<EntityList>`, `<EntityForm>` and
   `<EntityView>` stand alone; `<EntityManager>` only wires them together.
   The original forced `view: { fields: [] }` and `actions: { actions: [] }`
   stubs onto a call site that only wanted a create form.
3. **react-hook-form + zod** instead of 1,753 hand-rolled lines.
4. **Built on `createResource`** (`lib/api/hooks.ts`) rather than a second
   673-line HTTP client.
5. **Twelve field types plus `custom`**, three view modes, no builder layer.
6. **No dependency on a component library.** Plain Tailwind, so it works in
   the bare template; swap in your own primitives at the `components/entity/`
   boundary.

Target: the same capability at roughly a tenth of the volume.


---

## Second pass — gaps found by auditing the first pass

Three of the claims above were written before the code that backs them
existed. Recording the correction rather than quietly fixing it, because the
lesson generalises: a rewrite that documents its intentions is easy to mistake
for a rewrite that implemented them.

**`FormData` conversion did not exist.** The mutations accepted
`TInput | FormData` — meaning the caller had to build multipart by hand — and
nothing detected a `File`. Now `lib/api/form-data.ts` does, with the cases
that silently corrupt a request pinned by tests: `false` surviving (a
truthiness guard drops it, so unchecking a box appears to do nothing), `0`
surviving, explicit `null` becoming `''` (clear) while `undefined` is omitted
(leave alone), `Date` as ISO 8601 rather than a locale string, and arrays
repeating the key for `QueryDict.getlist()`.

**`type: 'file'` was broken end to end.** It fell through to the generic input
branch, so `register()` put a `FileList` — not a `File` — into the form values,
and nothing unwrapped it. `FileField` now unwraps via `Controller`, shows the
existing value when editing (so saving a form does not silently clear an
avatar), and can actually clear a selection, which an uncontrolled file input
cannot.

**Filters were declared but unimplemented.** `EntityListState.filters` existed
and nothing ever wrote to it. There is now a `FilterConfig` with Django
lookups, URL-backed like the rest of the list state, and an `EntityFilters`
bar. Deliberately no `date-range` type: a range is two filters (`gte` and
`lte`), which composes without a special case and lets each end carry its own
label.

Also fixed while verifying: the template could not build without network
access, because `next/font/google` downloads font files at build time —
breaking `docker build` with no egress, CI behind a proxy, and any offline
build. Replaced with a system font stack, which additionally removes the
bundle cost and the font-swap layout shift. `app/layout.tsx` documents how to
use `next/font/local` when a real typeface is wanted.

Tests now cover the pure logic (39 assertions across `form-data`, `format` and
`filterParamName`) plus the accessibility contract of the list — `aria-sort`,
a keyboard-reachable sort button, and the indeterminate select-all checkbox,
all of which look correct visually while being broken for assistive tech.


---

## Third pass — the strongest evidence was hiding in the same repo

The first two passes argued from usage counts inside `entityManager`. This
pass looked at what the source project's own developers did when they had a
choice, and it is a better argument than any of them.

### They built a second, smaller abstraction — and it won

Alongside the 21,892-line `entityManager`, `components/modules/_shared/`
exists: **1,340 lines**, thirteen files.

| | Lines | Files importing it |
|---|---|---|
| `entityManager` | 21,892 | 179 |
| `_shared` | 1,340 | 237 |

The 1,340-line one has *more* adoption. Broken down by module, `_shared` leads
in four of the five modules that use either:

```
financeManager        entityManager:35   _shared:75
leaseManager          entityManager:25   _shared:48
userManager           entityManager:52   _shared:64
propertyManager       entityManager:55   _shared:42
notificationsManager  entityManager:11   _shared:8
```

Whole feature areas are built entirely on `_shared`. The invoicing module's
`config/list/columns.tsx` declares `FinanceManagerColumn[]` — a type from
`_shared/types.ts` — and never touches `entityManager` at all.

### What `_shared` is

Not a framework. Thirteen composable presentational components:

```
EntityShell 100   EntityHeader 161   EntityTabs 104   EntityBreadcrumb 56
InfoGrid     71   StatCard      90   StatusTimeline 95  ActionMenu    81
EmptyState   84   SlidingPanel 224   types        144   status-colors 96
```

No config normalizer, no builders, no orchestrator. Each piece does one
visual job and composes with the others.

### Why this is the decisive finding

Adoption is a revealed preference, and it is much harder to argue with than a
line count. Given a config-driven monolith that generated whole screens and a
handful of small components that generated nothing, the team reached for the
small components more often — while the monolith's builder layer went to
**zero** call sites.

The instinct behind `entityManager` was right (see the top of this file); the
form was wrong. Config-driven generation is valuable exactly where the shape
genuinely repeats — a paginated table, a validated form — and a liability
everywhere else, because every screen that does not fit the mould has to be
argued past the framework instead of simply composed.

This is why the rewrite exports `<EntityList>`, `<EntityForm>` and
`<EntityView>` as independent components rather than an `<EntityManager>` that
owns the screen. The evidence for that choice was sitting in the same
repository the whole time.

### What was adopted from `_shared` as a result

Two gaps it exposed, both now closed:

- **`ActionMenu`.** Real modules declare two to four row actions each (86
  across the app) and `_shared/types.ts` carries an `inMenu` flag for exactly
  this. Rendering four inline buttons per row makes the actions column wider
  than the data. `components/entity/action-menu.tsx` shows the first inline
  and collapses the rest — with the keyboard contract a hand-rolled menu
  usually misses: `aria-haspopup`/`aria-expanded`, arrow-key cycling, Escape
  closing *and returning focus to the trigger*, outside-click on `mousedown`
  so the dismissing click does not also activate what is underneath. Eight
  tests pin it.
- **Grouped detail fields.** Every finance module has a `view/tabs.tsx`
  splitting a long record into groups. `ColumnConfig.section` now groups
  `<EntityView>` under headings — the smaller answer than a tab bar, since it
  needs no state, prints correctly, is reachable by Ctrl-F, and hides nothing
  behind a click.

Deliberately **not** adopted: `SlidingPanel` (a drawer is a routing decision,
and Next.js parallel routes do it better), `StatusTimeline` (domain-shaped),
`EntityShell`/`EntityHeader`/`EntityBreadcrumb` (page chrome belongs to the
app's layout, not to an entity library — putting it here is how a CRUD helper
turns into a framework that owns your page).


---

## Fourth pass — closing the audit

A systematic sweep of `entityManager/index.ts` — its complete public surface —
against this implementation. The point is to be able to say "same capability"
as a checked claim rather than an impression.

| Original export | Here | Note |
|---|---|---|
| `EntityManager` (orchestrator) | *dropped* | Replaced by composing the three components. Justified by the adoption evidence above. |
| `EntityList` | `EntityList` | |
| `EntityForm` | `EntityForm` | react-hook-form + zod |
| `EntityView` | `EntityView` | plus `section` grouping |
| `EntityActions` | `RowAction` / `BulkAction` / `ActionMenu` | with a real keyboard contract |
| `EntityExporter` | `exportable` + `exportFormats` + `onExport` | see below |
| `composition/*` builders | *dropped* | 0 call sites in the source project |
| `EntityApiProvider`, `EntityStateProvider` | *dropped* | 0 call sites |
| `createHttpClient` | `createResource` | `lib/api/hooks.ts` |
| `useFilters` | `useEntityList` | URL-backed |
| `usePagination` | `useEntityList` | URL-backed |
| `useSelection` | `useEntityList` | by id, not row object |
| `useSort` | `useEntityList` | three-state cycle |
| `FilterConfig` / `FilterOperator` | `FilterConfig` / `FilterLookup` | Django lookups |
| `SortConfig`, `PaginationConfig` | `EntityListState` | one object |
| `primitives/utils/validation` | zod | |
| `primitives/utils/formatting` | `lib/entity/format.ts` | cached `Intl` |
| `ViewTab`, `FieldGroup` | `ColumnConfig.section` | headings, not tabs |
| `InlineEdit`, `useTouchGestures`, `useResponsiveView`, `EntityImporter`, `BulkActions` | *dropped* | 0 call sites each |

### On the exporter

`<EntityExporter>` is never rendered anywhere in the source project — the
config is declared (`formats`, `defaultFormat`, `fields` with labels) and
consumed by the orchestrator.

Here, `exportFormats` covers format choice, and field selection is expressed
by passing `fields` through the export call's query params. The important
difference is where the allowlist lives: the source project declared
exportable fields on the **client**, which is a suggestion. The Django
template's `BaseModelViewSet.export_fields` enforces it on the **server**,
which is a control — see `PATTERNS.md` §8 for why defaulting to "every model
field" made every column added later silently downloadable.

### Verdict

Nothing in the original's public surface is unreachable here, and the three
things that are genuinely gone had zero call sites in the project that
shipped them. The remaining differences are deliberate and documented:
composition instead of orchestration, server-enforced export allowlists
instead of client-declared ones, headings instead of tabs.

Final: **~3,100 lines** against 21,892 — 14%, including a test suite the
original's equivalent modules did not have. 47 tests, clean typecheck, clean
build.
