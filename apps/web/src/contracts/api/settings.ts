export interface SettingsLogoPatchRequestBody {
  owlAscii: string;
}

export interface SettingsLogoPatchResponseBody {
  owlAscii: string;
}

export type ReadingModeDto = "reader" | "checker";

export interface SettingsReadingModePatchRequestBody {
  readingMode: ReadingModeDto;
}

export interface SettingsReadingModePatchResponseBody {
  readingMode: ReadingModeDto;
}
