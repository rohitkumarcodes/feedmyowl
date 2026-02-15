import { describe, expect, it } from "vitest";
import { shouldFocusReaderRoot } from "./article-reader-focus";

interface FakeElement extends EventTarget {
  nodeType: 1;
  tagName: string;
  parentElement: FakeElement | null;
  tabIndex: number;
  isContentEditable: boolean;
  getAttribute(name: string): string | null;
}

interface FakeTextNode extends EventTarget {
  nodeType: 3;
  parentElement: FakeElement | null;
}

function createFakeElement(
  tagName: string,
  options: {
    parent?: FakeElement | null;
    tabIndex?: number;
    attributes?: Record<string, string>;
    isContentEditable?: boolean;
  } = {},
): FakeElement {
  const attributes = new Map<string, string>();
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    attributes.set(name.toLowerCase(), value);
  }

  const element = {
    nodeType: 1 as const,
    tagName: tagName.toUpperCase(),
    parentElement: options.parent ?? null,
    tabIndex: options.tabIndex ?? -1,
    isContentEditable: options.isContentEditable ?? false,
    getAttribute(name: string) {
      return attributes.get(name.toLowerCase()) ?? null;
    },
  };

  return element as unknown as FakeElement;
}

function createFakeTextNode(parent: FakeElement): FakeTextNode {
  const textNode = {
    nodeType: 3 as const,
    parentElement: parent,
  };

  return textNode as unknown as FakeTextNode;
}

describe("article-reader-focus", () => {
  it("returns true for plain content targets, including text nodes", () => {
    const root = createFakeElement("div");
    const paragraph = createFakeElement("p", { parent: root });
    const textNode = createFakeTextNode(paragraph);

    expect(shouldFocusReaderRoot(root)).toBe(true);
    expect(shouldFocusReaderRoot(paragraph)).toBe(true);
    expect(shouldFocusReaderRoot(textNode)).toBe(true);
  });

  it("returns false for interactive targets", () => {
    const interactiveTags = ["a", "button", "input", "textarea", "select", "summary"];
    for (const tagName of interactiveTags) {
      expect(shouldFocusReaderRoot(createFakeElement(tagName))).toBe(false);
    }

    expect(shouldFocusReaderRoot(createFakeElement("div", { tabIndex: 0 }))).toBe(false);
    expect(
      shouldFocusReaderRoot(
        createFakeElement("div", { attributes: { contenteditable: "true" } }),
      ),
    ).toBe(false);
  });

  it("returns false when an interactive ancestor wraps the target", () => {
    const interactiveAncestor = createFakeElement("a");
    const plainChild = createFakeElement("span", { parent: interactiveAncestor });
    expect(shouldFocusReaderRoot(plainChild)).toBe(false);

    const editableAncestor = createFakeElement("div", {
      attributes: { contenteditable: "true" },
    });
    const nestedChild = createFakeElement("strong", { parent: editableAncestor });
    expect(shouldFocusReaderRoot(nestedChild)).toBe(false);
  });
});
