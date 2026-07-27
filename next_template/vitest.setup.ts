import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Unmount between tests. Without it, queries like getByRole find elements from
// a previous test's tree and failures point at the wrong place.
afterEach(() => {
  cleanup();
});

// jsdom implements neither of these, and both are touched by ordinary
// component code — matchMedia by the theme provider, ResizeObserver by most
// chart and popover libraries. Stubbing them here avoids a `TypeError` that
// has nothing to do with what is being tested.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
