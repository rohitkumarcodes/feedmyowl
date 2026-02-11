/**
 * Global Site Metadata
 *
 * This data is available in all templates as {{ metadata.title }}, etc.
 * Used by layouts, the RSS feed, and any template that needs site-wide info.
 */

function resolveAbsoluteUrl(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

const siteUrl = resolveAbsoluteUrl(
  process.env.BLOG_SITE_URL || process.env.NEXT_PUBLIC_LANDING_PAGE_URL,
  "https://feedmyowl.com"
);
const appUrl = resolveAbsoluteUrl(
  process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL,
  "https://app.feedmyowl.com"
);

export default {
  title: "feedmyowl",
  description: "A distraction-free RSS and Atom reading experience.",
  url: siteUrl,
  appUrl,
  author: {
    name: "feedmyowl",
  },
  feed: {
    subtitle: "Notes on building a distraction-free RSS and Atom reader.",
    filename: "feed.xml",
    path: "/feed/feed.xml",
    id: `${siteUrl}/`,
  },
};
