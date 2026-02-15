const READER_LINE_STEP_LINES = 3;
const READER_PAGE_STEP_RATIO = 0.875;
const FALLBACK_FONT_SIZE_PX = 18;
const FALLBACK_LINE_HEIGHT_MULTIPLIER = 1.65;

export type ReaderScrollDirection = 1 | -1;

function toFinitePositiveNumber(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parsePx(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return toFinitePositiveNumber(parsed);
}

function getReaderBody(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>("[data-article-reader-body]");
}

export function getReaderLineHeightPx(root: HTMLElement): number {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
    return FALLBACK_FONT_SIZE_PX * FALLBACK_LINE_HEIGHT_MULTIPLIER;
  }

  const body = getReaderBody(root) ?? root;
  const computed = window.getComputedStyle(body);
  const lineHeight = parsePx(computed.lineHeight);
  if (lineHeight) {
    return lineHeight;
  }

  const fontSize = parsePx(computed.fontSize) ?? FALLBACK_FONT_SIZE_PX;
  return fontSize * FALLBACK_LINE_HEIGHT_MULTIPLIER;
}

export function getReaderLineStepPx(root: HTMLElement): number {
  return getReaderLineHeightPx(root) * READER_LINE_STEP_LINES;
}

export function getReaderPageStepPx(root: HTMLElement): number {
  const viewportHeight = toFinitePositiveNumber(root.clientHeight) ?? 0;
  return viewportHeight * READER_PAGE_STEP_RATIO;
}

function clampScrollTop(root: HTMLElement, targetScrollTop: number): number {
  const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
  return Math.min(maxScrollTop, Math.max(0, targetScrollTop));
}

function applyScrollTop(root: HTMLElement, top: number, behavior: ScrollBehavior) {
  if (typeof root.scrollTo === "function") {
    root.scrollTo({ top, behavior });
    return;
  }

  root.scrollTop = top;
}

function scrollReaderByDelta(
  root: HTMLElement,
  deltaPx: number,
  behavior: ScrollBehavior,
): boolean {
  const currentTop = root.scrollTop;
  const nextTop = clampScrollTop(root, currentTop + deltaPx);

  if (Math.abs(nextTop - currentTop) < 0.5) {
    return false;
  }

  applyScrollTop(root, nextTop, behavior);
  return true;
}

export function scrollReaderByLine(
  root: HTMLElement,
  direction: ReaderScrollDirection,
  behavior: ScrollBehavior,
): boolean {
  const deltaPx = getReaderLineStepPx(root) * direction;
  return scrollReaderByDelta(root, deltaPx, behavior);
}

export function scrollReaderByPage(
  root: HTMLElement,
  direction: ReaderScrollDirection,
  behavior: ScrollBehavior,
): boolean {
  const deltaPx = getReaderPageStepPx(root) * direction;
  return scrollReaderByDelta(root, deltaPx, behavior);
}
