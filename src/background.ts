import {
  isLanguage,
  isTheme,
  messageTypes,
  parseStoredPreferences,
  type ExtensionRequest,
  type ExtensionResponse,
  type ExtensionState,
  type Language,
  type Theme,
} from "./shared.js";

const realtimeRulesetId = "facebook_realtime";
const languageStorageKey = "language";
const themeStorageKey = "theme";
const enabledBadgeColor = "#15803d";
const disabledBadgeColor = "#b91c1c";

type DiagnosticEvent =
  | { event: "badgeUpdateFailed" }
  | { event: "requestFailed"; requestType: string }
  | { event: "rejectedMessage"; receivedType: unknown };

function logDiagnostic(
  detail: DiagnosticEvent,
  error: unknown,
): void {
  console.error(
    JSON.stringify({
      ...detail,
      message: error instanceof Error ? error.message : String(error),
    }),
  );
}

async function getPreferences(): Promise<{
  language: Language;
  theme: Theme;
}> {
  const storedValues: unknown = await chrome.storage.local.get([
    languageStorageKey,
    themeStorageKey,
  ]);

  return parseStoredPreferences(storedValues);
}

async function getExtensionState(): Promise<ExtensionState> {
  const [enabledRulesetIds, preferences] = await Promise.all([
    chrome.declarativeNetRequest.getEnabledRulesets(),
    getPreferences(),
  ]);
  const enabledRulesets = new Set(enabledRulesetIds);

  return {
    realtimeBlockingEnabled: enabledRulesets.has(realtimeRulesetId),
    ...preferences,
  };
}

async function setRealtimeBlocking(enabled: boolean): Promise<void> {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? [realtimeRulesetId] : [],
    disableRulesetIds: enabled ? [] : [realtimeRulesetId],
  });
}

async function setLanguage(language: Language): Promise<void> {
  await chrome.storage.local.set({ [languageStorageKey]: language });
}

async function setTheme(theme: Theme): Promise<void> {
  await chrome.storage.local.set({ [themeStorageKey]: theme });
}

async function reloadFacebookTabs(): Promise<{
  reloadedTabCount: number;
  failedTabCount: number;
}> {
  const tabs = await chrome.tabs.query({
    url: ["https://*.facebook.com/*", "https://*.messenger.com/*"],
  });
  const tabIds = tabs.flatMap((tab) =>
    typeof tab.id === "number" ? [tab.id] : [],
  );
  const reloadResults = await Promise.allSettled(
    tabIds.map((tabId) => chrome.tabs.reload(tabId)),
  );

  const reloadedTabCount = reloadResults.filter(
    (result) => result.status === "fulfilled",
  ).length;

  return {
    reloadedTabCount,
    failedTabCount: reloadResults.length - reloadedTabCount,
  };
}

async function updateActionBadge(state: ExtensionState): Promise<void> {
  const isEnabled = state.realtimeBlockingEnabled;

  await Promise.all([
    chrome.action.setBadgeText({ text: isEnabled ? "ON" : "OFF" }),
    chrome.action.setBadgeBackgroundColor({
      color: isEnabled ? enabledBadgeColor : disabledBadgeColor,
    }),
    chrome.action.setTitle({
      title:
        state.language === "vi"
          ? isEnabled
            ? "FB Active Status: đang bật"
            : "FB Active Status: đang tắt"
          : isEnabled
            ? "FB Active Status: enabled"
            : "FB Active Status: disabled",
    }),
  ]);
}

async function getStateAndUpdateBadge(): Promise<ExtensionState> {
  const state = await getExtensionState();
  await updateActionBadge(state).catch(logBadgeUpdateFailure);
  return state;
}

function isExtensionRequest(message: unknown): message is ExtensionRequest {
  if (typeof message !== "object" || message === null || !("type" in message)) {
    return false;
  }

  const requestType: unknown = message.type;

  switch (requestType) {
    case messageTypes.getState:
      return true;
    case messageTypes.reloadFacebookTabs:
      return true;
    case messageTypes.setRealtimeBlocking:
      return "enabled" in message && typeof message.enabled === "boolean";
    case messageTypes.setLanguage:
      return "language" in message && isLanguage(message.language);
    case messageTypes.setTheme:
      return "theme" in message && isTheme(message.theme);
    default:
      return false;
  }
}

async function handleRequest(
  request: ExtensionRequest,
): Promise<ExtensionResponse> {
  switch (request.type) {
    case messageTypes.getState: {
      return { type: "state", state: await getStateAndUpdateBadge() };
    }
    case messageTypes.setRealtimeBlocking: {
      await setRealtimeBlocking(request.enabled);
      return { type: "state", state: await getStateAndUpdateBadge() };
    }
    case messageTypes.setLanguage: {
      await setLanguage(request.language);
      return { type: "state", state: await getStateAndUpdateBadge() };
    }
    case messageTypes.setTheme: {
      await setTheme(request.theme);
      return { type: "state", state: await getStateAndUpdateBadge() };
    }
    case messageTypes.reloadFacebookTabs: {
      const counts = await reloadFacebookTabs();
      return {
        type: "reloaded",
        state: await getStateAndUpdateBadge(),
        ...counts,
      };
    }
    default: {
      const _exhaustive: never = request;
      return _exhaustive;
    }
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isExtensionRequest(message)) {
    if (typeof message === "object" && message !== null && "type" in message) {
      logDiagnostic({ event: "rejectedMessage", receivedType: message.type }, null);
    }
    return false;
  }

  void handleRequest(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      const response: ExtensionResponse = {
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      };
      logDiagnostic({ event: "requestFailed", requestType: message.type }, error);
      sendResponse(response);
    });

  return true;
});

function logBadgeUpdateFailure(error: unknown): void {
  logDiagnostic({ event: "badgeUpdateFailed" }, error);
}

chrome.runtime.onInstalled.addListener(() => {
  void getStateAndUpdateBadge().catch(logBadgeUpdateFailure);
});

chrome.runtime.onStartup.addListener(() => {
  void getStateAndUpdateBadge().catch(logBadgeUpdateFailure);
});

void getStateAndUpdateBadge().catch(logBadgeUpdateFailure);
