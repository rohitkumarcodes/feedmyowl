import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "feed my owl",
  description: "A minimalist RSS/Atom feed reader that preserves your attention.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
