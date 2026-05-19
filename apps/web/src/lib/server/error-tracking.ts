/**
 * Module Boundary: Error Tracking
 *
 * Simple console-based error tracking.
 */
import "server-only";

export function captureError(error: unknown, context?: Record<string, unknown>) {
  console.error("[error]", error, context ?? "");
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
) {
  if (level === "error") {
    console.error("[message]", message);
  } else if (level === "warning") {
    console.warn("[message]", message);
  } else {
    console.log("[message]", message);
  }
}
