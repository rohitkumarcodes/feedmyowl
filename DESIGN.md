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

## 3. Sidebar information hierarchy
- Global scopes first (`Read all feeds`, `Uncategorized`)
- Feed actions (`Refresh`, `Add feed`, `New folder`)
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

## 6. Keyboard model
- Existing reading shortcuts unchanged:
  - `j` / `ArrowDown`
  - `k` / `ArrowUp`
  - `Enter`
  - `r`

## 7. Accessibility baseline
- Folder toggles provide `aria-expanded`.
- Menus and dialogs are keyboard reachable and close on `Escape`.
- Focus-visible styles preserved for all interactive controls.

## 8. Constraints
- No nested folders.
- No new search UI.
- No decorative folder colors/icons in this phase.
- No drag-drop ordering in this phase.
