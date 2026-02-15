export interface RefreshResultDto {
  feedId: string;
  feedUrl: string;
  newItemCount: number;
  status: "success" | "error";
  fetchState?: "updated" | "not_modified";
  errorCode?: string;
  errorMessage?: string;
}

export interface RefreshResponseBody {
  results: RefreshResultDto[];
  retentionDeletedCount: number;
  message?: string;
}
