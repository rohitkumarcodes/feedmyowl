import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

/**
 * This page checks auth at request time and redirects — it must never
 * be statically prerendered. force-dynamic tells Next.js to always
 * render it on the server per-request.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const { userId } = await auth();
    if (userId) {
      redirect("/feeds");
    }
  } catch {
    // If Clerk server auth isn't available, fail closed to sign-in
    // instead of rendering the global error page at "/".
  }

  redirect("/sign-in");
}
