/**
 * Event bridge used by top-level account controls to open the feeds shortcuts dialog.
 */

export const OPEN_SHORTCUTS_DIALOG_EVENT = "feedmyowl:shortcuts:open";

export function emitOpenShortcutsDialogEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(OPEN_SHORTCUTS_DIALOG_EVENT));
}
