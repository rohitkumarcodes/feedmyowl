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
    card: {
      backgroundColor: "transparent",
      border: "none",
      borderRadius: "0",
      boxShadow: "none",
      padding: "0",
    },
    header: {
      display: "none",
    },
    headerTitle: {
      display: "none",
    },
    headerSubtitle: {
      display: "none",
    },
    form: {
      margin: "0",
      padding: "0 40px 24px",
    },
    main: {
      padding: "0",
    },
    formContainer: {
      margin: "0",
      padding: "0",
    },
    formFieldRow: {
      margin: "0 0 20px",
    },
    formField: {
      margin: "0",
    },
    formFieldLabel: {
      color: "#3d396e",
      fontSize: "13px",
      fontWeight: "600",
      marginBottom: "8px",
    },
    formButtonPrimary: {
      backgroundColor: "#3d396e",
      border: "none",
      borderRadius: "4px",
      color: "#fff",
      cursor: "pointer",
      fontSize: "15px",
      fontWeight: "600",
      padding: "12px",
      textTransform: "none",
      transition: "opacity 0.2s",
      width: "100%",
      "&:hover": {
        opacity: "0.9",
      },
    },
    formFieldInput: {
      background: "#ffffff",
      border: "1px solid #8480b5",
      borderRadius: "4px",
      color: "#3d396e",
      fontSize: "14px",
      padding: "12px",
      "&:focus": {
        border: "1px solid #3d396e",
      },
    },
    footer: {
      borderTop: "1px solid #ebeaf4",
      padding: "16px 40px 8px",
      textAlign: "center",
    },
    footerAction: {
      margin: "0",
    },
    footerActionText: {
      color: "#8480b5",
      fontSize: "14px",
      margin: "0",
    },
    footerActionLink: {
      color: "#3d396e",
      fontSize: "14px",
      fontWeight: "700",
      textDecoration: "none",
    },
  },
} satisfies AuthEntryAppearance;
