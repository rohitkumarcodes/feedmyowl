"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import type { FeedViewModel } from "@/components/feeds-types";
import { loadWorkspaceSnapshot, saveWorkspaceSnapshot } from "@/lib/offline-cache";

interface UseFeedsWorkspaceNetworkOptions {
  feeds: FeedViewModel[];
  setFeeds: Dispatch<SetStateAction<FeedViewModel[]>>;
}

/**
 * Offline snapshot persistence and network-status messaging.
 */
export function useFeedsWorkspaceNetwork({
  feeds,
  setFeeds,
}: UseFeedsWorkspaceNetworkOptions) {
  const [networkMessage, setNetworkMessage] = useState<string | null>(null);

  useEffect(() => {
    void saveWorkspaceSnapshot({
      savedAt: new Date().toISOString(),
      feeds,
    }).catch(() => {
      // Snapshot cache failures should not interrupt reading flow.
    });
  }, [feeds]);

  useEffect(() => {
    if (navigator.onLine) {
      return;
    }

    void loadWorkspaceSnapshot()
      .then((snapshot) => {
        if (!snapshot) {
          return;
        }

        setFeeds(snapshot.feeds);
        setNetworkMessage(
          "Could not connect to the server. Previously loaded articles are available."
        );
      })
      .catch(() => {
        // If snapshot loading fails, the UI falls back to current in-memory data.
      });
  }, [setFeeds]);

  useEffect(() => {
    const onOnline = () => setNetworkMessage(null);
    const onOffline = () =>
      setNetworkMessage(
        "Could not connect to the server. Previously loaded data remains available."
      );

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
