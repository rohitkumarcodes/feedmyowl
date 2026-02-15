export type SidebarScope =
  | { type: "none" }
  | { type: "all" }
  | { type: "uncategorized" }
  | { type: "folder"; folderId: string }
  | { type: "feed"; feedId: string };
