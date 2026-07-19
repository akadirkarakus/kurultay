import "@testing-library/jest-dom/vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// React 18+ requires this to be set explicitly outside of tooling
// (Create React App, Next.js test runner) that sets it automatically.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
