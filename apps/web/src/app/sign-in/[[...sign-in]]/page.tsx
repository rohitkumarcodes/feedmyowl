/**
 * Sign In Page
 *
 * Renders Clerk's pre-built <SignIn /> component.
 * The [[...sign-in]] catch-all route handles all sign-in sub-routes
 * (e.g., /sign-in, /sign-in/factor-one, etc.) that Clerk needs.
 *
 * Docs: https://clerk.com/docs/components/authentication/sign-in
 */

import { SignInForm } from "@/lib/auth";

export default function SignInPage() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <SignInForm />
    </div>
  );
}
