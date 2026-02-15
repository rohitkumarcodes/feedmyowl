import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getReaderLineStepPx,
  getReaderPageStepPx,
  scrollReaderByLine,
  scrollReaderByPage,
} from "./article-reader-scroll";

const globalWithOptionalWindow = globalThis as typeof globalThis & {
  window?: Window;
};
const originalWindow = globalWithOptionalWindow.window;

function installComputedStyleMock(style: { lineHeight: string; fontSize: string }) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      getComputedStyle: vi.fn(() => style),
    },
  });
}

function restoreWindow() {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
}

function createReaderRoot(options?: {
  clientHeight?: number;
  scrollHeight?: number;
  scrollTop?: number;
}) {
  const body = {} as HTMLElement;
  const root = {
    clientHeight: options?.clientHeight ?? 800,
    scrollHeight: options?.scrollHeight ?? 2400,
    scrollTop: options?.scrollTop ?? 0,
    querySelector: vi.fn((selector: string) => {
      if (selector === "[data-article-reader-body]") {
        return body;
      }

      return null;
    }),
  } as unknown as HTMLElement;

  const scrollTo = vi.fn((options: ScrollToOptions) => {
    if (typeof options.top === "number") {
      root.scrollTop = options.top;
    }
  });

  Object.defineProperty(root, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });

  return { root, body, scrollTo };
}

afterEach(() => {
  restoreWindow();
});

describe("article-reader-scroll", () => {
  it("derives line step from reader body line-height", () => {
    installComputedStyleMock({ lineHeight: "24px", fontSize: "18px" });
    const { root } = createReaderRoot();

    expect(getReaderLineStepPx(root)).toBe(72);
  });

  it("falls back to font-size multiplier when line-height is non-numeric", () => {
    installComputedStyleMock({ lineHeight: "normal", fontSize: "20px" });
    const { root } = createReaderRoot();

    expect(getReaderLineStepPx(root)).toBeCloseTo(99, 4);
  });

  it("uses an 87.5% page-step ratio", () => {
    const { root } = createReaderRoot({ clientHeight: 800 });

    expect(getReaderPageStepPx(root)).toBe(700);
  });

  it("clamps page scroll at edges and no-ops when already at edge", () => {
    installComputedStyleMock({ lineHeight: "24px", fontSize: "18px" });
    const { root, scrollTo } = createReaderRoot({
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 550,
    });

    const didScrollToBottom = scrollReaderByPage(root, 1, "smooth");
    expect(didScrollToBottom).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 600, behavior: "smooth" });

    const didScrollPastBottom = scrollReaderByPage(root, 1, "smooth");
    expect(didScrollPastBottom).toBe(false);

    root.scrollTop = 0;
    const didScrollPastTop = scrollReaderByLine(root, -1, "auto");
    expect(didScrollPastTop).toBe(false);
  });
});
