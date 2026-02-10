# FeedMyOwl Design Spec

## 1. Design goal
Prioritize uninterrupted reading while adding lightweight organization.

## 2. Product shape
### Desktop/tablet
Three panes:
1. Sidebar (scopes, folders, feeds, add controls)
2. Article list
3. Reader

### Mobile
Three stacked views:
1. Feeds
2. Articles
3. Reader
- In-app back buttons use deterministic transitions (`Reader -> Articles -> Feeds`)
  to avoid accidental exits caused by unrelated browser history.
- Small-screen layout hides fixed brand chrome and uses a reduced sidebar top reserve.

## 3. Sidebar information hierarchy
- Global scopes first (`Read all feeds`, `Uncategorized`)
- Toolbar actions (`Refresh`, `Add feed/folder`, `Shortcuts (?)` on desktop/tablet)
- One-time shortcuts hint area (dismissible on desktop/tablet)
- Sidebar message stack (progress/offline/info/error)
- Folder groups with explicit expand/collapse controls
- Feed rows nested under folders

## 4. Folder visual behavior
- Single-level folder hierarchy.
- Folder rows show name + feed count.
- Active folder and active feed use selected-state treatment.
- Feed rows can appear in multiple folder sections.

## 5. Interaction model
- Add-feed supports folder multi-select and inline folder creation.
- Feed row menu supports:
  - Edit name
  - Folders assignment checklist
  - Delete
- Folder row menu supports:
  - Edit name
  - Delete (with mode dialog)
- Workspace connectivity message appears only while offline and clears silently on reconnect.
- Sidebar notices are semantic and consistent:
  - `progress` and `offline` are non-dismissible status notices.
  - `info` is dismissible and auto-clears after 8s unless actionable.
  - `error` is dismissible and shown with stronger contrast.
- Settings import shows numeric progress while processing feed URLs.
- Settings delete entry point is text-first (`Delete account...`) before confirmation.
- Article list keeps an always-visible global search input with fuzzy-ranked results.
- Active search replaces scoped list content but keeps sidebar scope selection visible.

## 6. Keyboard model
- Scope and availability:
  - Active only on feeds workspace.
  - Active only on desktop/tablet; disabled on mobile.
  - Disabled while user is typing in editable targets.
- Key map:
  - `j`: next article (list + reader contexts)
  - `k`: previous article (list + reader contexts)
  - `ArrowDown`: next article (list context only)
  - `ArrowUp`: previous article (list context only)
  - `Enter`: open selected article (list context only)
  - `r`: refresh feeds
  - `/`: focus article search input
  - `?`: open shortcuts help modal
  - `Escape`: close shortcuts help modal or clear search input when focused
- Discoverability:
  - Visible toolbar entry `Shortcuts (?)`
  - One-time tip shown on desktop/tablet until dismissed or modal opened

## 7. Accessibility baseline
- Folder toggles provide `aria-expanded`.
- Menus and dialogs are keyboard reachable and close on `Escape`.
- Focus-visible styles preserved for all interactive controls.
- Shortcuts dialog traps focus while open and returns focus on close.
- Message roles:
  - `error` uses `role="alert"` (assertive live region).
  - `progress`, `offline`, and `info` use `role="status"` (polite live region).

## 8. Constraints
- No nested folders.
- No decorative folder colors/icons in this phase.
- No drag-drop ordering in this phase.

## 9. Brand behavior
- Authenticated layout brand keeps text fixed as `Feed my owl`.
- Brand owl is rendered as monospaced ASCII art from user preference.
- Default ASCII owl is `{o,o}` for users without a saved preference.
- Settings provides explicit selection + save; favicon mirrors selected ASCII owl.

## 10. Title tone behavior
- Article title dot marker remains unchanged.
- Unread titles use `--text-primary`.
- Read titles use `--text-secondary` with normal font weight.
