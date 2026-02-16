export type IsoDateString = string;

export interface ApiErrorDetail {
  field?: string;
  reason?: string;
  value?: unknown;
  [key: string]: unknown;
}

export interface ApiErrorBody {
  error: string;
  code?: string;
  hint?: string;
  retryAfterSeconds?: number;
  correlationId?: string;
  details?: ApiErrorDetail[] | Record<string, unknown> | string | null;
}
