/**
 * Entity components — the public surface.
 *
 * Three standalone components plus the config type. There is no orchestrator
 * god-component and no builder layer.
 *
 * The source project exported an `<EntityManager>` that owned view switching,
 * which forced every call site to describe every view: a create-only screen
 * still had to pass `list: { columns: [] }`, `view: { fields: [] }` and
 * `actions: { actions: [] }`. Composing three components instead means a page
 * declares only what it renders, and routing stays in the router — where
 * Next.js already handles URLs, back-button behaviour and code splitting far
 * better than a `useState<'list'|'create'|'edit'|'view'>` can.
 *
 * If you want the combined widget, it is a dozen lines in your own app:
 *
 *     const [mode, setMode] = useState<'list' | 'create'>('list');
 *     return mode === 'list'
 *       ? <EntityList ... />
 *       : <EntityForm ... onCancel={() => setMode('list')} />;
 */

export { EntityList } from './entity-list';
export { EntityForm } from './entity-form';
export { EntityView } from './entity-view';
export { EntityFilters } from './entity-filters';
export { ActionMenu } from './action-menu';

export { useEntityList } from '@/lib/entity/use-entity-list';
export type { EntityListController } from '@/lib/entity/use-entity-list';

export { formatValue, formatRelative, defaultTone, readPath } from '@/lib/entity/format';
export { filterParamName } from '@/lib/entity/types';

export type {
  BaseEntity,
  BadgeTone,
  BulkAction,
  ColumnConfig,
  ColumnFormat,
  EntityConfig,
  EntityListState,
  FilterConfig,
  FilterLookup,
  FieldConfig,
  FieldRenderProps,
  FieldType,
  RowAction,
  SelectOption,
  ViewMode,
} from '@/lib/entity/types';
