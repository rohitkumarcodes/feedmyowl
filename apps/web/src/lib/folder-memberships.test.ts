import { describe, expect, it } from "vitest";
import {
  getFeedMembershipFolderIds,
  normalizeFolderIds,
  resolveFeedFolderIds,
} from "@/lib/folder-memberships";

describe("folder memberships helpers", () => {
  it("normalizes folder IDs with stable ordering", () => {
    expect(normalizeFolderIds([" folder-b ", "folder-a", "folder-a", ""])).toEqual([
      "folder-a",
      "folder-b",
    ]);
  });

  it("resolves feed folder IDs from memberships only", () => {
    expect(resolveFeedFolderIds(["folder-b", "folder-a", "folder-b"])).toEqual([
      "folder-a",
      "folder-b",
    ]);
  });

  it("extracts membership IDs from relational feed shape", () => {
    expect(
      getFeedMembershipFolderIds({
        folderMemberships: [{ folderId: "folder-a" }, { folderId: "folder-b" }],
      })
    ).toEqual(["folder-a", "folder-b"]);
    expect(getFeedMembershipFolderIds({})).toEqual([]);
  });
});
