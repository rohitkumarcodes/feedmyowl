import { describe, expect, it } from "vitest";
import type { SidebarScope } from "@/features/feeds/types/scopes";
import {
  parseSidebarRowKey,
  resolveSidebarArrowNavigation,
} from "./sidebar-keyboard-navigation";

describe("resolveSidebarArrowNavigation", () => {
  const visible: SidebarScope[] = [
    { type: "saved" },
    { type: "folder", folderId: "folder-a" },
    { type: "feed", feedId: "feed-1" },
    { type: "folder", folderId: "folder-b" },
  ];

  it("returns null when visible list is empty", () => {
    const next = resolveSidebarArrowNavigation({
      step: 1,
      currentScope: { type: "saved" },
      visibleScopes: [],
    });
    expect(next).toBeNull();
  });

  it("returns first item on Down when current is none", () => {
    const next = resolveSidebarArrowNavigation({
      step: 1,
      currentScope: { type: "none" },
      visibleScopes: visible,
    });
    expect(next).toEqual({ type: "saved" });
  });

  it("returns last item on Up when current is none", () => {
    const next = resolveSidebarArrowNavigation({
      step: -1,
      currentScope: { type: "none" },
      visibleScopes: visible,
    });
    expect(next).toEqual({ type: "folder", folderId: "folder-b" });
  });

  it("steps down to next sibling", () => {
    const next = resolveSidebarArrowNavigation({
      step: 1,
      currentScope: { type: "folder", folderId: "folder-a" },
      visibleScopes: visible,
    });
    expect(next).toEqual({ type: "feed", feedId: "feed-1" });
  });

  it("steps up to previous sibling", () => {
    const next = resolveSidebarArrowNavigation({
      step: -1,
      currentScope: { type: "feed", feedId: "feed-1" },
      visibleScopes: visible,
    });
    expect(next).toEqual({ type: "folder", folderId: "folder-a" });
  });

  it("clamps at the bottom boundary", () => {
    const next = resolveSidebarArrowNavigation({
      step: 1,
      currentScope: { type: "folder", folderId: "folder-b" },
      visibleScopes: visible,
    });
    expect(next).toEqual({ type: "folder", folderId: "folder-b" });
  });

  it("clamps at the top boundary", () => {
    const next = resolveSidebarArrowNavigation({
      step: -1,
      currentScope: { type: "saved" },
      visibleScopes: visible,
    });
    expect(next).toEqual({ type: "saved" });
  });

  it("falls back to first item when current scope is no longer visible", () => {
    const next = resolveSidebarArrowNavigation({
      step: 1,
      currentScope: { type: "feed", feedId: "missing-feed" },
      visibleScopes: visible,
    });
    expect(next).toEqual({ type: "saved" });
  });
});

describe("parseSidebarRowKey", () => {
  it("parses scope-name-only keys", () => {
    expect(parseSidebarRowKey("saved")).toEqual({ type: "saved" });
    expect(parseSidebarRowKey("all")).toEqual({ type: "all" });
    expect(parseSidebarRowKey("unread")).toEqual({ type: "unread" });
    expect(parseSidebarRowKey("uncategorized")).toEqual({ type: "uncategorized" });
  });

  it("parses folder and feed prefixed keys", () => {
    expect(parseSidebarRowKey("folder:abc-123")).toEqual({
      type: "folder",
      folderId: "abc-123",
    });
    expect(parseSidebarRowKey("feed:xyz-789")).toEqual({
      type: "feed",
      feedId: "xyz-789",
    });
  });

  it("returns null for unrecognized keys", () => {
    expect(parseSidebarRowKey("")).toBeNull();
    expect(parseSidebarRowKey("garbage")).toBeNull();
    expect(parseSidebarRowKey("folder:")).toEqual({ type: "folder", folderId: "" });
  });
});
