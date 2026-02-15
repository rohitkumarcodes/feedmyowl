export type SidebarScope =
  | { type: "none" }
  | { type: "all" }
  | { type: "unread" }
  | { type: "saved" }
  | { type: "uncategorized" }
  | { type: "folder"; folderId: string }
  | { type: "feed"; feedId: string };
