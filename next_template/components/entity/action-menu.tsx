'use client';

/**
 * Overflow menu for row actions.
 *
 * Rendering every action as an inline button stops working at about three:
 * the actions column grows wider than the data, and on a narrow screen it
 * pushes the table into horizontal scroll. The source project's modules
 * declare two to four actions each (86 across the app), which is exactly the
 * range where this matters — its own `ActionConfig` carried an `inMenu` flag
 * for the same reason.
 *
 * So: the first `inlineCount` actions render as buttons, the rest collapse
 * into a menu.
 *
 * Built on native `<button>` plus explicit keyboard handling rather than a
 * headless-UI dependency, because the template has no component library and
 * a menu is small enough to own. What it implements, because a div-with-
 * onClick does none of it:
 *
 *   - `aria-haspopup` / `aria-expanded` so the trigger announces itself
 *   - Escape closes and returns focus to the trigger
 *   - a click outside closes
 *   - arrow keys move between items
 *   - `role="menu"` / `role="menuitem"` semantics
 */

import { useEffect, useRef, useState } from 'react';

import type { BaseEntity, RowAction } from '@/lib/entity/types';

interface ActionMenuProps<T extends BaseEntity> {
  actions: RowAction<T>[];
  row: T;
  /** Actions shown as buttons before the rest collapse into the menu. */
  inlineCount?: number;
}

export function ActionMenu<T extends BaseEntity>({
  actions,
  row,
  inlineCount = 1,
}: ActionMenuProps<T>) {
  const visible = actions.filter((action) => action.visible?.(row) ?? true);
  if (visible.length === 0) return null;

  // With only one more than the inline budget, a menu costs more clicks than
  // it saves — show them all.
  const collapse = visible.length > inlineCount + 1;
  const inline = collapse ? visible.slice(0, inlineCount) : visible;
  const overflow = collapse ? visible.slice(inlineCount) : [];

  return (
    <div className="flex items-center justify-end gap-1">
      {inline.map((action) => (
        <ActionButton key={action.id} action={action} row={row} />
      ))}
      {overflow.length > 0 && <Overflow actions={overflow} row={row} />}
    </div>
  );
}

async function runAction<T extends BaseEntity>(action: RowAction<T>, row: T) {
  const message =
    typeof action.confirm === 'function' ? action.confirm(row) : action.confirm;
  // window.confirm keeps the template dependency-free. Swap in your own
  // dialog — the shape of this call is what matters, not the prompt.
  if (message && !window.confirm(message)) return;
  await action.onSelect(row);
}

function ActionButton<T extends BaseEntity>({
  action,
  row,
}: {
  action: RowAction<T>;
  row: T;
}) {
  const disabled = action.disabled?.(row) ?? false;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => runAction(action, row)}
      className={[
        'rounded px-2 py-1 text-xs',
        action.tone === 'danger' ? 'text-destructive' : '',
        disabled ? 'opacity-40' : 'hover:underline',
      ].join(' ')}
    >
      {action.icon ?? action.label}
    </button>
  );
}

function Overflow<T extends BaseEntity>({
  actions,
  row,
}: {
  actions: RowAction<T>[];
  row: T;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Close on outside click. `mousedown` rather than `click` so the menu is
  // gone before the click lands on whatever is underneath — otherwise a
  // click meant to dismiss also activates the element behind it.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Move focus into the menu when it opens, so keyboard users are not left
  // on the trigger with an open menu they cannot reach.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      // Returning focus to the trigger is what makes Escape non-destructive:
      // without it focus falls to the document body and the user loses their
      // place in the table.
      triggerRef.current?.focus();
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'ArrowDown'
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        onClick={() => setOpen((value) => !value)}
        className="rounded px-2 py-1 text-xs hover:bg-muted"
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {open && (
        <div
          role="menu"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-md border bg-popover py-1 text-popover-foreground shadow-lg"
        >
          {actions.map((action, index) => {
            const disabled = action.disabled?.(row) ?? false;
            return (
              <button
                key={action.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                role="menuitem"
                type="button"
                disabled={disabled}
                onClick={async () => {
                  setOpen(false);
                  await runAction(action, row);
                }}
                className={[
                  'block w-full px-3 py-1.5 text-left text-xs',
                  action.tone === 'danger' ? 'text-destructive' : '',
                  disabled
                    ? 'opacity-40'
                    : 'hover:bg-muted',
                ].join(' ')}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
