/**
 * Eleventy Configuration
 *
 * This file configures the Eleventy static site generator for the
 * FeedMyOwl blog and landing page (feedmyowl.com).
 *
 * Plugins:
 *   - @11ty/eleventy-plugin-rss: Generates an Atom feed for the blog
 *   - @11ty/eleventy-navigation: Adds navigation data to templates
 *
 * Docs: https://www.11ty.dev/docs/config/
 */

import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginNavigation from "@11ty/eleventy-navigation";

export default function (eleventyConfig) {
  // --- Plugins ---
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(pluginNavigation);

  // --- Global data ---
  // Make the current year available in all templates as {{ currentYear }}
  eleventyConfig.addGlobalData("currentYear", () => new Date().getFullYear());

  // --- Passthrough copy ---
  // Copy the public/ folder to the output as-is (for images, fonts, etc.)
  eleventyConfig.addPassthroughCopy("public");
  // Copy source CSS into /css so the layout link (/css/style.css) resolves.
  eleventyConfig.addPassthroughCopy({
    "src/css": "css",
  });
  // Watch CSS files in dev mode for immediate reloads.
  eleventyConfig.addWatchTarget("src/css/**/*.css");

  // --- Date filter ---
  // Format dates for display in templates
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  // ISO date string for HTML datetime attribute
  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    return new Date(dateObj).toISOString();
  });

  return {
    // Template formats to process
    templateFormats: ["md", "njk", "html"],

    // Use Nunjucks for markdown and HTML preprocessing
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",

    // Directory configuration
    dir: {
      input: "src",           // Source files
      includes: "_includes",  // Template partials and layouts
      data: "_data",          // Global data files
      output: "_site",        // Build output (gitignored)
    },
  };
}
