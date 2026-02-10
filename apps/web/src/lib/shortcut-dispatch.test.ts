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

  it("maps arrow keys and enter only in list context", () => {
    expect(
      resolveShortcutAction(eventSnapshot("ArrowDown"), {
        ...baseContext,
        isListContext: true,
      })
    ).toBe("article.next.arrow");

    expect(
      resolveShortcutAction(eventSnapshot("ArrowDown"), {
        ...baseContext,
        isReaderContext: true,
      })
    ).toBeNull();

    expect(
      resolveShortcutAction(eventSnapshot("Enter"), {
        ...baseContext,
        isListContext: true,
      })
    ).toBe("article.open");
  });

  it("maps workspace-wide actions when not typing", () => {
    expect(resolveShortcutAction(eventSnapshot("r"), baseContext)).toBe("feeds.refresh");
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
