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
      border: "1px solid #8480b5",
      boxShadow: "0 2px 4px rgba(61, 57, 110, 0.04)",
      backgroundColor: "#ffffff",
    },
    headerTitle: {
      display: "none",
    },
    headerSubtitle: {
      fontSize: "14px",
      marginTop: "8px",
      textAlign: "center",
    },
    formButtonPrimary: {
      fontSize: "14px",
      textTransform: "none",
      backgroundColor: "#3d396e",
      "&:hover": {
        backgroundColor: "#2a274f",
      },
    },
    formFieldInput: {
      border: "1px solid #8480b5",
      "&:focus": {
        border: "1px solid #3d396e",
      },
    },
    footerActionText: {
      fontSize: "14px",
      color: "#8480b5",
    },
    footerActionLink: {
      fontSize: "14px",
      fontWeight: "700",
      color: "#3d396e",
    },
  },
} satisfies AuthEntryAppearance;
