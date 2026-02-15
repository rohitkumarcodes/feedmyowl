import type { IsoDateString } from "./common";

export interface FolderDto {
  id: string;
  name: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface FolderCreateRequestBody {
  name: string;
}

export interface FolderCreateResponseBody {
  folder: FolderDto;
}

export interface FolderRenameRequestBody {
  name: string;
}

export interface FolderRenameResponseBody {
  folder: FolderDto;
}

export type FolderDeleteMode = "remove_only" | "remove_and_unsubscribe_exclusive";

export interface FolderDeleteResponseBody {
  success: true;
  mode: FolderDeleteMode;
  totalFeeds: number;
  exclusiveFeeds: number;
  crossListedFeeds: number;
  unsubscribedFeeds: number;
}
