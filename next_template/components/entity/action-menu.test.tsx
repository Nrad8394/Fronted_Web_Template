import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ActionMenu } from './action-menu';
import type { RowAction } from '@/lib/entity/types';

/**
 * The keyboard contract is the whole reason this component exists rather than
 * a div with an onClick. Every assertion below covers behaviour that is
 * invisible in a screenshot and broken in most hand-rolled menus.
 */

interface Row {
  id: string;
  name: string;
  [key: string]: unknown;
}

const row: Row = { id: '1', name: 'Widget' };

function actions(count: number, over: Partial<RowAction<Row>> = {}): RowAction<Row>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `a${i}`,
    label: `Action ${i}`,
    onSelect: vi.fn(),
    ...over,
  }));
}

describe('ActionMenu', () => {
  it('shows all actions inline when there are few', () => {
    // With inlineCount=1 and two actions, a menu would cost more clicks than
    // it saves, so both render as buttons.
    render(<ActionMenu actions={actions(2)} row={row} inlineCount={1} />);

    expect(screen.getByRole('button', { name: 'Action 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument();
  });

  it('collapses the surplus into a menu', () => {
    render(<ActionMenu actions={actions(4)} row={row} inlineCount={1} />);

    expect(screen.getByRole('button', { name: 'Action 0' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Action 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
  });

  it('announces its expanded state', async () => {
    const user = userEvent.setup();
    render(<ActionMenu actions={actions(4)} row={row} />);

    const trigger = screen.getByRole('button', { name: /more actions/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('moves focus into the menu on open', async () => {
    const user = userEvent.setup();
    render(<ActionMenu actions={actions(4)} row={row} />);

    await user.click(screen.getByRole('button', { name: /more actions/i }));

    // Without this, a keyboard user is left on the trigger with an open menu
    // they cannot reach.
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus();
  });

  it('cycles focus with arrow keys', async () => {
    const user = userEvent.setup();
    render(<ActionMenu actions={actions(4)} row={row} />);

    await user.click(screen.getByRole('button', { name: /more actions/i }));
    const items = screen.getAllByRole('menuitem');

    await user.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();

    // Wraps rather than dead-ending at the edges.
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(items[items.length - 1]).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<ActionMenu actions={actions(4)} row={row} />);

    const trigger = screen.getByRole('button', { name: /more actions/i });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // Dropping focus to <body> would lose the user's place in the table.
    expect(trigger).toHaveFocus();
  });

  it('runs the action and closes when a menu item is chosen', async () => {
    const user = userEvent.setup();
    const list = actions(4);
    render(<ActionMenu actions={list} row={row} />);

    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Action 1' }));

    expect(list[1].onSelect).toHaveBeenCalledWith(row);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('omits actions whose `visible` returns false', () => {
    const list = actions(4, { visible: () => false });
    render(<ActionMenu actions={list} row={row} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
