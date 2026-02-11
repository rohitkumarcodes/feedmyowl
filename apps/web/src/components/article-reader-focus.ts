const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

const INTERACTIVE_TAG_NAMES = new Set([
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "summary",
]);

interface ElementLike {
  nodeType?: number;
  tagName?: string;
  parentElement?: EventTarget | null;
  tabIndex?: number;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

function isElementLike(value: EventTarget | null): value is EventTarget & ElementLike {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as ElementLike;
  return candidate.nodeType === ELEMENT_NODE && typeof candidate.tagName === "string";
}

function isTextLike(value: EventTarget | null): value is EventTarget & ElementLike {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (value as ElementLike).nodeType === TEXT_NODE;
}

function resolveTargetElement(target: EventTarget | null): (EventTarget & ElementLike) | null {
  if (isElementLike(target)) {
    return target;
  }

  if (!isTextLike(target)) {
    return null;
  }

  const parent = target.parentElement ?? null;
  return isElementLike(parent) ? parent : null;
}

function getAttributeValue(element: EventTarget & ElementLike, name: string): string | null {
  if (typeof element.getAttribute !== "function") {
    return null;
  }

  return element.getAttribute(name);
}

function hasNonNegativeTabIndex(element: EventTarget & ElementLike): boolean {
  if (typeof element.tabIndex === "number" && Number.isFinite(element.tabIndex)) {
    return element.tabIndex >= 0;
  }

  const rawTabIndex = getAttributeValue(element, "tabindex");
  if (rawTabIndex === null) {
    return false;
  }

  const parsedTabIndex = Number.parseInt(rawTabIndex, 10);
  return Number.isFinite(parsedTabIndex) && parsedTabIndex >= 0;
}

function isContentEditableElement(element: EventTarget & ElementLike): boolean {
  if (element.isContentEditable === true) {
    return true;
  }

  const rawValue = getAttributeValue(element, "contenteditable");
  if (rawValue === null) {
    return false;
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  return normalizedValue === "" || normalizedValue === "true" || normalizedValue === "plaintext-only";
}

function isInteractiveElement(element: EventTarget & ElementLike): boolean {
  const tagName = element.tagName?.toLowerCase() ?? "";
  if (INTERACTIVE_TAG_NAMES.has(tagName)) {
    return true;
  }

  if (isContentEditableElement(element)) {
    return true;
  }

  return hasNonNegativeTabIndex(element);
}

export function shouldFocusReaderRoot(target: EventTarget | null): boolean {
  const resolvedTarget = resolveTargetElement(target);
  if (!resolvedTarget) {
    return false;
  }

  let current: (EventTarget & ElementLike) | null = resolvedTarget;
  while (current) {
    if (isInteractiveElement(current)) {
      return false;
    }

    const parent = current.parentElement ?? null;
    current = isElementLike(parent) ? parent : null;
  }

  return true;
}
