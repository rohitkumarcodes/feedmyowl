"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import type { FeedViewModel, FolderViewModel } from "@/components/feeds-types";
import { loadWorkspaceSnapshot, saveWorkspaceSnapshot } from "@/lib/offline-cache";
import { OFFLINE_CACHED_ARTICLES_MESSAGE } from "@/lib/network-messages";

interface UseFeedsWorkspaceNetworkOptions {
  feeds: FeedViewModel[];
  folders: FolderViewModel[];
  setFeeds: Dispatch<SetStateAction<FeedViewModel[]>>;
  setFolders: Dispatch<SetStateAction<FolderViewModel[]>>;
}

/**
 * Offline snapshot persistence and network-status messaging.
 */
export function useFeedsWorkspaceNetwork({
  feeds,
  folders,
  setFeeds,
  setFolders,
}: UseFeedsWorkspaceNetworkOptions) {
  const [networkMessage, setNetworkMessage] = useState<string | null>(null);

  useEffect(() => {
    void saveWorkspaceSnapshot({
      savedAt: new Date().toISOString(),
      feeds,
      folders,
    }).catch(() => {
      // Snapshot cache failures should not interrupt reading flow.
    });
  }, [feeds, folders]);

  useEffect(() => {
    if (navigator.onLine) {
      return;
    }

    setNetworkMessage(OFFLINE_CACHED_ARTICLES_MESSAGE);

    void loadWorkspaceSnapshot()
      .then((snapshot) => {
        if (!snapshot) {
          return;
        }

        setFeeds(snapshot.feeds);
        setFolders(snapshot.folders ?? []);
      })
      .catch(() => {
        // If snapshot loading fails, the UI falls back to current in-memory data.
      });
  }, [setFeeds, setFolders]);

  useEffect(() => {
    const onOnline = () => setNetworkMessage(null);
    const onOffline = () => setNetworkMessage(OFFLINE_CACHED_ARTICLES_MESSAGE);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return {
    networkMessage,
    setNetworkMessage,
  };
}
