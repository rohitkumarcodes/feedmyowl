import "server-only";

export type ParseRequestJsonResult =
  | { status: "ok"; payload: Record<string, unknown> }
  | { status: "invalid_json" }
  | { status: "payload_too_large" };

function toUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export async function parseRequestJsonWithLimit(
  request: Request,
  options: { maxBytes: number },
): Promise<ParseRequestJsonResult> {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
      return { status: "payload_too_large" };
    }
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return { status: "invalid_json" };
  }

  if (toUtf8ByteLength(rawBody) > options.maxBytes) {
    return { status: "payload_too_large" };
  }

  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { status: "invalid_json" };
    }

    return {
      status: "ok",
      payload: parsed as Record<string, unknown>,
    };
  } catch {
    return { status: "invalid_json" };
  }
}

export async function parseRequestJson(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
