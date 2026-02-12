import { describe, expect, it } from "vitest";
import { resolveShortcutAction } from "./shortcut-dispatch";

const baseContext = {
  enabled: true,
  isTypingTarget: false,
  isListContext: false,
  isReaderContext: false,
  isShortcutsModalOpen: false,
} as const;

function eventSnapshot(
  key: string,
  overrides?: Partial<{
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  }>
) {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  };
}

describe("shortcut-dispatch", () => {
  it("maps j/k for list and reader context", () => {
    expect(
      resolveShortcutAction(eventSnapshot("j"), {
        ...baseContext,
        isListContext: true,
      })
    ).toBe("article.next.vim");

    expect(
      resolveShortcutAction(eventSnapshot("k"), {
        ...baseContext,
        isReaderContext: true,
      })
    ).toBe("article.previous.vim");
  });

  it("maps list navigation keys in list context", () => {
    expect(
      resolveShortcutAction(eventSnapshot("ArrowDown"), {
        ...baseContext,
        isListContext: true,
      })
    ).toBe("article.next.arrow");

    expect(
      resolveShortcutAction(eventSnapshot("Enter"), {
        ...baseContext,
        isListContext: true,
      })
    ).toBe("article.open");

    expect(
      resolveShortcutAction(eventSnapshot("ArrowDown"), {
        ...baseContext,
        isReaderContext: true,
      })
    ).toBeNull();
  });

  it("maps reader scroll keys only in reader context", () => {
    expect(
      resolveShortcutAction(eventSnapshot("ArrowDown"), {
        ...baseContext,
        isReaderContext: true,
      })
    ).toBe("reader.scroll.lineDown");

    expect(
      resolveShortcutAction(eventSnapshot("ArrowUp"), {
        ...baseContext,
        isReaderContext: true,
      })
    ).toBe("reader.scroll.lineUp");

    expect(
      resolveShortcutAction(eventSnapshot("PageDown"), {
        ...baseContext,
        isReaderContext: true,
      })
    ).toBe("reader.scroll.pageDown");

    expect(
      resolveShortcutAction(eventSnapshot("PageUp"), {
        ...baseContext,
        isReaderContext: true,
      })
    ).toBe("reader.scroll.pageUp");

    expect(
      resolveShortcutAction(eventSnapshot(" "), {
        ...baseContext,
        isReaderContext: true,
      })
    ).toBe("reader.scroll.pageDown");

    expect(
      resolveShortcutAction(eventSnapshot(" ", { shiftKey: true }), {
        ...baseContext,
        isReaderContext: true,
      })
    ).toBe("reader.scroll.pageUp");

    expect(
      resolveShortcutAction(eventSnapshot("PageDown"), {
        ...baseContext,
        isListContext: true,
      })
    ).toBeNull();
  });

  it("maps workspace-wide actions when not typing", () => {
    expect(resolveShortcutAction(eventSnapshot("r"), baseContext)).toBe("feeds.refresh");
    expect(resolveShortcutAction(eventSnapshot("f"), baseContext)).toBe(
      "workspace.focusCycle"
    );
    expect(resolveShortcutAction(eventSnapshot("/"), baseContext)).toBe("search.focus");
    expect(resolveShortcutAction(eventSnapshot("?"), baseContext)).toBe("shortcuts.open");
    expect(resolveShortcutAction(eventSnapshot("/", { shiftKey: true }), baseContext)).toBe(
      "shortcuts.open"
    );
  });

  it("ignores shortcuts while typing or using command modifiers", () => {
    expect(
      resolveShortcutAction(eventSnapshot("j"), {
        ...baseContext,
        isTypingTarget: true,
        isListContext: true,
      })
    ).toBeNull();

    expect(
      resolveShortcutAction(eventSnapshot("r", { metaKey: true }), {
        ...baseContext,
        isListContext: true,
      })
    ).toBeNull();

    expect(
      resolveShortcutAction(eventSnapshot("f"), {
        ...baseContext,
        isTypingTarget: true,
      })
    ).toBeNull();

    expect(
      resolveShortcutAction(eventSnapshot("/"), {
        ...baseContext,
        isTypingTarget: true,
      })
    ).toBeNull();
  });

  it("only allows Escape while shortcuts modal is open", () => {
    expect(
      resolveShortcutAction(eventSnapshot("Escape"), {
        ...baseContext,
        isShortcutsModalOpen: true,
      })
    ).toBe("shortcuts.close");

    expect(
      resolveShortcutAction(eventSnapshot("j"), {
        ...baseContext,
        isListContext: true,
        isShortcutsModalOpen: true,
      })
    ).toBeNull();

    expect(
      resolveShortcutAction(eventSnapshot("f"), {
        ...baseContext,
        isShortcutsModalOpen: true,
      })
    ).toBeNull();

    expect(
      resolveShortcutAction(eventSnapshot("r"), {
        ...baseContext,
        isShortcutsModalOpen: true,
      })
    ).toBeNull();
  });

  it("disables all shortcuts when the feature is not enabled", () => {
    expect(
      resolveShortcutAction(eventSnapshot("j"), {
        ...baseContext,
        enabled: false,
        isListContext: true,
      })
    ).toBeNull();
  });
});
