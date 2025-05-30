import '@testing-library/jest-dom';

// Properly typed global interface extensions
declare global {
  interface Window {
    IntersectionObserver: typeof IntersectionObserver;
    ResizeObserver: typeof ResizeObserver;
  }

  interface Global {
    IntersectionObserver: typeof IntersectionObserver;
    ResizeObserver: typeof ResizeObserver;
    scrollTo: jest.MockedFunction<typeof window.scrollTo>;
  }
}

// Mock IntersectionObserver
(window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = jest
  .fn()
  .mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));

// Mock ResizeObserver
(window as unknown as { ResizeObserver: unknown }).ResizeObserver = jest
  .fn()
  .mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));

// Mock window.matchMedia
const mockMatchMedia = jest.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(), // deprecated
  removeListener: jest.fn(), // deprecated
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

// Mock window.scrollTo
(window as unknown as { scrollTo: unknown }).scrollTo = jest.fn();
