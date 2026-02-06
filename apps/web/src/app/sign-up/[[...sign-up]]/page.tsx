/**
 * Sign Up Page
 *
 * Renders Clerk's pre-built <SignUp /> component.
 * The [[...sign-up]] catch-all route handles all sign-up sub-routes
 * that Clerk needs internally.
 *
 * Docs: https://clerk.com/docs/components/authentication/sign-up
 */

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <SignUp />
    </div>
  );
}
