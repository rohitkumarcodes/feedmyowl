import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

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
