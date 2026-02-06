/**
 * Global Site Metadata
 *
 * This data is available in all templates as {{ metadata.title }}, etc.
 * Used by layouts, the RSS feed, and any template that needs site-wide info.
 */

export default {
  title: "FeedMyOwl",
  description: "A calm, minimalist RSS reader that preserves your attention.",
  url: "https://feedmyowl.com",
  appUrl: "https://app.feedmyowl.com",
  author: {
    name: "FeedMyOwl",
  },
  feed: {
    subtitle: "Updates from the FeedMyOwl blog.",
    filename: "feed.xml",
    path: "/feed/feed.xml",
    id: "https://feedmyowl.com/",
  },
};
