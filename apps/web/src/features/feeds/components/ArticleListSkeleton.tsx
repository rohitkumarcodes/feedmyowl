/**
 * Skeleton placeholder rows shown while articles are loading for a newly
 * selected scope. Gives the user an immediate visual signal that content is
 * on its way, avoiding the flash of "No articles in this feed."
 */

import styles from "./ArticleListSkeleton.module.css";

const ROW_COUNT = 5;

export function ArticleListSkeleton() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      {Array.from({ length: ROW_COUNT }, (_, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.title} />
          <div className={styles.meta} />
        </div>
      ))}
    </div>
  );
}
