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

// Older jsdom environments lack TextEncoder/TextDecoder (present in all
// supported browsers). Provide Node's implementation for tests.
const nodeUtil = require('node:util');
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = nodeUtil.TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = nodeUtil.TextDecoder;
}
