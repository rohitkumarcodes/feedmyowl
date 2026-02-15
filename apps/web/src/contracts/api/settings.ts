export type ThemeModeDto = "system" | "light" | "dark";

export interface SettingsLogoPatchRequestBody {
  owlAscii: string;
}

export interface SettingsLogoPatchResponseBody {
  owlAscii: string;
}

export interface SettingsThemePatchRequestBody {
  themeMode: ThemeModeDto;
}

export interface SettingsThemePatchResponseBody {
  themeMode: ThemeModeDto;
}
