export type Language = "vi" | "en";
export type Theme = "system" | "light" | "dark";

export const messageTypes = {
  getState: "getState",
  setRealtimeBlocking: "setRealtimeBlocking",
  setLanguage: "setLanguage",
  setTheme: "setTheme",
  reloadFacebookTabs: "reloadFacebookTabs",
} as const;

export interface ExtensionState {
  realtimeBlockingEnabled: boolean;
  language: Language;
  theme: Theme;
}

export type ExtensionRequest =
  | { type: typeof messageTypes.getState }
  | {
      type: typeof messageTypes.setRealtimeBlocking;
      enabled: boolean;
    }
  | {
      type: typeof messageTypes.setLanguage;
      language: Language;
    }
  | {
      type: typeof messageTypes.setTheme;
      theme: Theme;
    }
  | { type: typeof messageTypes.reloadFacebookTabs };

export type ExtensionResponse =
  | { type: "state"; state: ExtensionState }
  | {
      type: "reloaded";
      state: ExtensionState;
      reloadedTabCount: number;
      failedTabCount: number;
    }
  | { type: "error"; error: string };

export type ExtensionResponseType = ExtensionResponse["type"];

export type ExtensionStateResponse = Extract<
  ExtensionResponse,
  { type: "state" }
>;

export type ExtensionReloadedResponse = Extract<
  ExtensionResponse,
  { type: "reloaded" }
>;

export function isLanguage(value: unknown): value is Language {
  return value === "vi" || value === "en";
}

export function isTheme(value: unknown): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

export function isExtensionResponseType(
  value: unknown,
): value is ExtensionResponseType {
  return value === "state" || value === "reloaded" || value === "error";
}

export function isExtensionState(value: unknown): value is ExtensionState {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("realtimeBlockingEnabled" in value)) {
    return false;
  }
  if (typeof value.realtimeBlockingEnabled !== "boolean") {
    return false;
  }
  if (!("language" in value) || !isLanguage(value.language)) {
    return false;
  }
  if (!("theme" in value) || !isTheme(value.theme)) {
    return false;
  }
  return true;
}

export function parseStoredPreferences(
  value: unknown,
): { language: Language; theme: Theme } {
  if (typeof value !== "object" || value === null) {
    return { language: "vi", theme: "system" };
  }

  const language: Language = "language" in value && isLanguage(value.language)
    ? value.language
    : "vi";
  const theme: Theme =
    "theme" in value && isTheme(value.theme) ? value.theme : "system";

  return { language, theme };
}

export function parseExtensionResponse(
  value: unknown,
): ExtensionResponse | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  if (!("type" in value) || !isExtensionResponseType(value.type)) {
    return undefined;
  }

  if (value.type === "error") {
    if (!("error" in value) || typeof value.error !== "string") {
      return undefined;
    }
    return { type: "error", error: value.error };
  }

  if (!("state" in value) || !isExtensionState(value.state)) {
    return undefined;
  }

  if (value.type === "reloaded") {
    if (
      !("reloadedTabCount" in value) ||
      typeof value.reloadedTabCount !== "number" ||
      !Number.isSafeInteger(value.reloadedTabCount) ||
      value.reloadedTabCount < 0 ||
      !("failedTabCount" in value) ||
      typeof value.failedTabCount !== "number" ||
      !Number.isSafeInteger(value.failedTabCount) ||
      value.failedTabCount < 0
    ) {
      return undefined;
    }
    return {
      type: "reloaded",
      state: value.state,
      reloadedTabCount: value.reloadedTabCount,
      failedTabCount: value.failedTabCount,
    };
  }

  return { type: "state", state: value.state };
}