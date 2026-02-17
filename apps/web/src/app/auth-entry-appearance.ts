/**
 * Auth Entry Appearance
 *
 * Clerk appearance overrides for the sign-in and sign-up pages.
 * These styles are passed directly to <SignInForm> and <SignUpForm> via
 * the `appearance` prop. Clerk applies them as inline styles, so they
 * override Clerk's default CSS without specificity issues.
 *
 * Brand palette reference:
 *   Deep indigo  #3d396e  — primary text, focused borders, buttons
 *   Mid lavender  #8480b5  — secondary text, unfocused borders
 *   Hint lavender #b8b5d6  — hint/optional text, muted elements
 *   Light lavender #ebeaf4  — backgrounds, subtle separators
 *
 * The outer card frame (white box with border) is controlled by
 * auth-page.module.css — this file only styles Clerk's internal elements.
 */

import type { ComponentProps } from "react";
import type { SignInForm } from "@/lib/server/auth";

type AuthEntryAppearance = NonNullable<ComponentProps<typeof SignInForm>["appearance"]>;

export const authEntryAppearance = {
  variables: {
    colorPrimary: "#3d396e",
    colorText: "#3d396e",
    colorTextSecondary: "#8480b5",
    borderRadius: "4px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  elements: {
    /* -------------------------------------------------------------- */
    /* Card — transparent because our .frame wrapper provides the box  */
    /* -------------------------------------------------------------- */
    card: {
      backgroundColor: "transparent",
      border: "none",
      borderRadius: "0",
      boxShadow: "none",
      padding: "0",
    },

    /* -------------------------------------------------------------- */
    /* Header — hidden because we render our own owl logo + title      */
    /* -------------------------------------------------------------- */
    header: {
      display: "none",
    },
    headerTitle: {
      display: "none",
    },
    headerSubtitle: {
      display: "none",
    },

    /* -------------------------------------------------------------- */
    /* Form layout — controls spacing around the form fields           */
    /* -------------------------------------------------------------- */
    form: {
      margin: "0",
      padding: "18px 40px 20px",
    },
    main: {
      padding: "0",
    },
    formContainer: {
      margin: "0",
      padding: "0",
    },

    /* -------------------------------------------------------------- */
    /* Form field rows — vertical gap between each field               */
    /* 14px keeps sign-up compact without feeling cramped              */
    /* -------------------------------------------------------------- */
    formFieldRow: {
      margin: "0 0 14px",
    },
    formField: {
      margin: "0",
    },

    /* -------------------------------------------------------------- */
    /* Label row — holds the label, "Optional" hint, and action links  */
    /* -------------------------------------------------------------- */
    formFieldLabelRow: {
      alignItems: "center",
      columnGap: "8px",
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "6px",
      padding: "0",
    },
    formFieldLabel: {
      color: "#3d396e",
      fontSize: "13px",
      fontWeight: "600",
      lineHeight: "20px",
      margin: "0",
    },

    /* -------------------------------------------------------------- */
    /* "Optional" hint text — must be clearly lighter than the label   */
    /* so it reads as metadata, not a competing label                  */
    /* -------------------------------------------------------------- */
    formFieldHintText: {
      color: "#b8b5d6",
      fontSize: "11px",
      fontWeight: "400",
      lineHeight: "20px",
      margin: "0",
    },

    /* -------------------------------------------------------------- */
    /* "Forgot password?" and similar action links on the label row    */
    /* Styled as secondary — less prominent than the field label       */
    /* -------------------------------------------------------------- */
    formFieldAction: {
      color: "#8480b5",
      fontSize: "12px",
      fontWeight: "500",
      textDecoration: "none",
      "&:hover": {
        color: "#3d396e",
        textDecoration: "underline",
      },
    },

    /* -------------------------------------------------------------- */
    /* "Last used" badge — small pill next to the email field label    */
    /* Kept subtle so it doesn't compete with the label text           */
    /* -------------------------------------------------------------- */
    lastAuthenticationStrategyBadge: {
      alignItems: "center",
      backgroundColor: "#ebeaf4",
      borderRadius: "999px",
      color: "#8480b5",
      display: "inline-flex",
      fontSize: "10px",
      fontWeight: "600",
      height: "18px",
      justifyContent: "center",
      lineHeight: "1",
      margin: "0",
      padding: "0 7px",
      verticalAlign: "middle",
    },

    /* -------------------------------------------------------------- */
    /* Text inputs — visible border, proper focus ring for a11y        */
    /* Border color #6e6aa0 is between mid-lavender and deep indigo    */
    /* -------------------------------------------------------------- */
    formFieldInput: {
      background: "#ffffff",
      border: "1px solid #6e6aa0",
      borderRadius: "4px",
      boxSizing: "border-box",
      color: "#3d396e",
      fontSize: "14px",
      padding: "12px",
      width: "100%",
      "&:focus": {
        border: "1px solid #3d396e",
        boxShadow: "0 0 0 1px #3d396e",
      },
    },

    /* -------------------------------------------------------------- */
    /* Eye icon button to show/hide password — muted so it doesn't     */
    /* compete with the input text                                     */
    /* -------------------------------------------------------------- */
    formFieldInputShowPasswordButton: {
      color: "#8480b5",
      "&:hover": {
        color: "#3d396e",
      },
    },

    /* -------------------------------------------------------------- */
    /* Continue / Submit button — flat design, no gradient or shadow    */
    /* -------------------------------------------------------------- */
    formButtonPrimary: {
      backgroundColor: "#3d396e",
      backgroundImage: "none",
      border: "none",
      borderRadius: "4px",
      boxShadow: "none",
      color: "#fff",
      cursor: "pointer",
      fontSize: "15px",
      fontWeight: "600",
      padding: "12px",
      textTransform: "none",
      transition: "opacity 0.2s",
      width: "100%",
      "&:hover": {
        backgroundImage: "none",
        boxShadow: "none",
        opacity: "0.9",
      },
      "&:active": {
        opacity: "0.8",
      },
    },

    /* -------------------------------------------------------------- */
    /* Footer — "Don't have an account? Sign up" / "Already have…"     */
    /* -------------------------------------------------------------- */
    footer: {
      borderTop: "1px solid #ebeaf4",
      margin: "4px 0 0",
      padding: "12px 40px 6px",
      textAlign: "center",
    },
    footerItem: {
      margin: "0",
      padding: "0",
    },
    footerAction: {
      alignItems: "center",
      display: "flex",
      justifyContent: "center",
      margin: "0",
      textAlign: "center",
      width: "100%",
    },
    footerActionText: {
      color: "#8480b5",
      fontSize: "14px",
      fontWeight: "500",
      lineHeight: "1.4",
      margin: "0",
    },
    footerActionLink: {
      color: "#3d396e",
      fontSize: "14px",
      fontWeight: "600",
      textDecoration: "none",
    },

    /* -------------------------------------------------------------- */
    /* "Get help" link — Clerk shows this on the password step         */
    /* Centered and muted so it doesn't look misplaced                 */
    /* -------------------------------------------------------------- */
    footerPages: {
      display: "flex",
      justifyContent: "center",
      margin: "0",
      padding: "4px 0 0",
    },
    footerPagesLink: {
      color: "#8480b5",
      fontSize: "12px",
      fontWeight: "500",
      textDecoration: "none",
    },
  },
} satisfies AuthEntryAppearance;
