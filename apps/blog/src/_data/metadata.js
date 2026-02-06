/**
 * Global Site Metadata
 *
 * This data is available in all templates as {{ metadata.title }}, etc.
 * Used by layouts, the RSS feed, and any template that needs site-wide info.
 */

export default {
  title: "feedmyowl",
  description: "A distraction-free RSS and Atom reading experience.",
  url: "https://feedmyowl.com",
  appUrl: "https://app.feedmyowl.com",
  author: {
    name: "feedmyowl",
  },
  feed: {
    subtitle: "Notes on building a distraction-free RSS and Atom reader.",
    filename: "feed.xml",
    path: "/feed/feed.xml",
    id: "https://feedmyowl.com/",
  },
};
