/**
 * Inline feed-subscription form shared by sidebar and toolbar triggers.
 */

import type { FormEvent } from "react";
import styles from "./AddFeedForm.module.css";

interface AddFeedFormProps {
  feedUrlInput: string;
  isAddingFeed: boolean;
  onFeedUrlChange: (value: string) => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;
  onCancelAddFeed: () => void;
}

/**
 * Renders a compact inline feed URL form that defaults new feeds to Uncategorized.
 */
export function AddFeedForm({
  feedUrlInput,
  isAddingFeed,
  onFeedUrlChange,
  onSubmitFeed,
  onCancelAddFeed,
}: AddFeedFormProps) {
  return (
    <form className={styles.form} onSubmit={onSubmitFeed}>
      <label className={styles.label} htmlFor="sidebar-feed-url">
        Feed URL
      </label>
      <input
        id="sidebar-feed-url"
        name="feed-url"
        type="url"
        required
        className={styles.input}
        value={feedUrlInput}
        onChange={(event) => onFeedUrlChange(event.currentTarget.value)}
        placeholder="https://example.com/rss.xml"
      />

      <div className={styles.actions}>
        <button type="submit" className={styles.button} disabled={isAddingFeed}>
          {isAddingFeed ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={onCancelAddFeed}
          disabled={isAddingFeed}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
