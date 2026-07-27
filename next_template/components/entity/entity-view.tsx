'use client';

/**
 * Read-only detail view.
 *
 * Uses `<dl>/<dt>/<dd>` rather than a grid of `<div>`s. A description list is
 * what this markup *is*, and screen readers announce the pairing — a
 * two-column grid of divs reads as an undifferentiated run of text.
 *
 * Falls back to `config.columns` when `config.detail` is absent, so a config
 * written for a table gets a usable detail view for free.
 */

import { useMemo } from 'react';

import type { BaseEntity, ColumnConfig, EntityConfig } from '@/lib/entity/types';
import { defaultTone, formatValue, readPath } from '@/lib/entity/format';

const toneClass: Record<string, string> = {
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  success: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
};

interface EntityViewProps<T extends BaseEntity> {
  config: EntityConfig<T>;
  entity?: T;
  isLoading?: boolean;
}

export function EntityView<T extends BaseEntity>({
  config,
  entity,
  isLoading,
}: EntityViewProps<T>) {
  const fields = useMemo(
    () => config.detail ?? config.columns ?? [],
    [config.detail, config.columns],
  );

  // Preserves declaration order: a Map keyed by section name keeps groups in
  // the order their first field appears, so the author controls the layout by
  // ordering the array rather than by an extra index property.
  const sections = useMemo(() => {
    const grouped = new Map<string, ColumnConfig<T>[]>();
    for (const field of fields) {
      const key = field.section ?? '';
      const list = grouped.get(key) ?? [];
      list.push(field);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries());
  }, [fields]);

  if (isLoading || !entity) {
    return (
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-busy="true">
        {fields.map((field) => (
          <div key={String(field.key)}>
            <dt className="text-xs opacity-60">{field.header}</dt>
            <dd className="mt-1 h-4 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map(([sectionName, sectionFields]) => (
        <section key={sectionName}>
          {sectionName && (
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-70">
              {sectionName}
            </h3>
          )}
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sectionFields.map((field) => (
              <div
                key={String(field.key)}
                className={field.span === 2 ? 'sm:col-span-2' : ''}
              >
                <dt className="text-xs uppercase tracking-wide opacity-60">
                  {field.header}
                </dt>
                <dd className="mt-1 text-sm">
                  <DetailValue entity={entity} field={field} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function DetailValue<T extends BaseEntity>({
  entity,
  field,
}: {
  entity: T;
  field: ColumnConfig<T>;
}) {
  if (field.render) return <>{field.render(entity)}</>;

  const value = readPath(entity, String(field.key));

  if (field.format === 'badge') {
    const tone = field.tone ? field.tone(value, entity) : defaultTone(value);
    return (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}
      >
        {String(value ?? '—')}
      </span>
    );
  }

  if (field.format === 'email' && value) {
    return (
      <a href={`mailto:${String(value)}`} className="underline">
        {String(value)}
      </a>
    );
  }

  if (field.format === 'link' && value) {
    return (
      <a
        href={String(value)}
        // noreferrer is not decoration: without it the target page can reach
        // back through window.opener and navigate this tab.
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        {String(value)}
      </a>
    );
  }

  if (field.format === 'image' && value) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={String(value)} alt="" className="h-20 w-20 rounded object-cover" />;
  }

  return <>{formatValue(value, field.format)}</>;
}
