import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

let objectUrlSequence = 0;

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: vi.fn(() => {
    objectUrlSequence += 1;
    return `blob:screening-test-${objectUrlSequence}`;
  }),
  writable: true,
});

Object.defineProperty(URL, "revokeObjectURL", {
  configurable: true,
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  })),
  writable: true,
});

class ResizeObserverStub {
  disconnect() {}
  observe() {}
  unobserve() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverStub,
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
  writable: true,
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
