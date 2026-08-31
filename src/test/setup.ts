import "@testing-library/jest-dom/vitest"

// JSDOM intentionally omits the Canvas 2D implementation. Components already
// treat a missing context as a supported no-animation fallback, so mirror that
// browser contract without emitting a warning for every rendered page.
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: () => null,
})
