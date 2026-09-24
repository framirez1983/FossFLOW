require('@testing-library/jest-dom');

// jsdom does not implement ResizeObserver (used by icon components via
// useResizeObserver). A no-op stub is enough for component tests.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = ResizeObserverStub;
}
