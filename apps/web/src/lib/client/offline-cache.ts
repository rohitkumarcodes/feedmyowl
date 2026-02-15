"use client";

/**
 * Client-side IndexedDB helpers for workspace snapshot caching.
 * This keeps previously loaded reading data available during offline sessions.
 */

import type { FeedViewModel, FolderViewModel } from "@/features/feeds/types/view-models";

const DB_NAME = "feedmyowl_offline_cache";
const DB_VERSION = 1;
const STORE_NAME = "workspace_snapshots";
const SNAPSHOT_KEY = "feeds_workspace_v1";

export interface WorkspaceSnapshot {
  savedAt: string;
  feeds: FeedViewModel[];
  folders: FolderViewModel[];
}

/**
 * Open (or create) the IndexedDB database used for offline snapshots.
 */
function openSnapshotDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

/**
 * Persist the latest feed state for offline fallback use.
 */
export async function saveWorkspaceSnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
  const db = await openSnapshotDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(snapshot, SNAPSHOT_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Snapshot save failed"));
  });

  db.close();
}

/**
 * Load the most recently cached workspace snapshot, if one exists.
 */
export async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot | null> {
  const db = await openSnapshotDb();

  const snapshot = await new Promise<WorkspaceSnapshot | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(SNAPSHOT_KEY);

    request.onsuccess = () => {
      const value = request.result as WorkspaceSnapshot | undefined;
      resolve(value ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error("Snapshot load failed"));
  });

  db.close();
  return snapshot;
}
