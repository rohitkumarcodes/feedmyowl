import { parseResponseJson } from "@/lib/client/http";

export interface ApiCallResult<T> {
  ok: boolean;
  status: number;
  body: T | null;
  networkError: boolean;
  headers: Headers | null;
}

export async function callJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ApiCallResult<T>> {
  try {
    const response = await fetch(input, init);
    const body = await parseResponseJson<T>(response);

    return {
      ok: response.ok,
      status: response.status,
      body,
      networkError: false,
      headers: response.headers,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      body: null,
      networkError: true,
      headers: null,
    };
  }
}
