/**
 * Authenticated route-group layout.
 *
 * This layout intentionally stays minimal so each page can control its own
 * structure without inheriting a decorative shell.
 */

/**
 * Returns route-group children without extra wrapper UI.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
