import type * as lucideModule from "lucide";
import {
  messageTypes,
  parseExtensionResponse,
  type ExtensionReloadedResponse,
  type ExtensionRequest,
  type ExtensionResponse,
  type ExtensionState,
  type ExtensionStateResponse,
  type Language,
  type Theme,
} from "./shared.js";

type StateRequest = Exclude<
  ExtensionRequest,
  { type: typeof messageTypes.reloadFacebookTabs }
>;

type SettingRequest = Exclude<
  StateRequest,
  { type: typeof messageTypes.getState }
>;

type RealtimeBlockingRequest = Extract<
  SettingRequest,
  { type: typeof messageTypes.setRealtimeBlocking }
>;

type FeedbackKind = "success" | "pending" | "error" | "info";

interface Translation {
  brandSubtitle: string;
  settingsLabel: string;
  languageLabel: string;
  themeLabel: string;
  systemMode: string;
  darkMode: string;
  lightMode: string;
  loading: string;
  enabled: string;
  disabled: string;
  realtimeBlocked: string;
  connected: string;
  realtimeTitle: string;
  realtimeHint: string;
  reload: string;
  reloadPending: string;
  reloadSuccess: (count: number) => string;
  reloadFailure: (reloadedCount: number, failedCount: number) => string;
  noTabs: string;
  note: string;
  noResponse: string;
  updateError: string;
  reloadError: string;
  stateError: string;
}

const translations: Record<Language, Translation> = {
  vi: {
    brandSubtitle: "Trạng thái hoạt động",
    settingsLabel: "Cài đặt",
    languageLabel: "Ngôn ngữ",
    themeLabel: "Giao diện",
    systemMode: "Theo hệ thống",
    darkMode: "Chế độ tối",
    lightMode: "Chế độ sáng",
    loading: "Đang tải…",
    enabled: "Đã chặn realtime",
    disabled: "Realtime đang chạy",
    realtimeBlocked: "Facebook không gửi trạng thái trực tiếp",
    connected: "Facebook gửi trạng thái trực tiếp",
    realtimeTitle: "Chặn realtime",
    realtimeHint: "Chặn luồng dữ liệu trạng thái của Facebook",
    reload: "Tải lại Facebook",
    reloadPending: "Chưa áp dụng, cần tải lại Facebook",
    reloadSuccess: (count) => `Đã tải lại ${count} tab`,
    reloadFailure: (reloadedCount, failedCount) =>
      `Đã tải lại ${reloadedCount} tab, ${failedCount} tab thất bại`,
    noTabs: "Không có tab Facebook đang mở",
    note: "Chặn kết nối realtime của Facebook",
    noResponse: "Extension không phản hồi",
    updateError: "Không thể cập nhật",
    reloadError: "Không thể tải lại tab",
    stateError: "Không thể đọc trạng thái",
  },
  en: {
    brandSubtitle: "Active status",
    settingsLabel: "Settings",
    languageLabel: "Language",
    themeLabel: "Theme",
    systemMode: "System",
    darkMode: "Dark mode",
    lightMode: "Light mode",
    loading: "Loading…",
    enabled: "Realtime blocked",
    disabled: "Realtime running",
    realtimeBlocked: "Facebook stops sending live status",
    connected: "Facebook sends live status",
    realtimeTitle: "Block realtime",
    realtimeHint: "Blocks Facebook's status stream",
    reload: "Reload Facebook",
    reloadPending: "Not applied yet, reload Facebook",
    reloadSuccess: (count) => `Reloaded ${count} tab${count === 1 ? "" : "s"}`,
    reloadFailure: (reloadedCount, failedCount) =>
      `Reloaded ${reloadedCount} tab${reloadedCount === 1 ? "" : "s"}, ${failedCount} failed`,
    noTabs: "No Facebook tabs open",
    note: "Blocks Facebook realtime connections",
    noResponse: "Extension did not respond",
    updateError: "Could not update",
    reloadError: "Could not reload tabs",
    stateError: "Could not read status",
  },
};

declare const lucide: Pick<typeof lucideModule, "createElement" | "icons">;

const popupElementTags = {
  brandIcon: "span",
  brandSubtitle: "p",
  feedback: "p",
  feedbackIcon: "span",
  feedbackText: "span",
  languageEnButton: "button",
  languageSwitch: "div",
  languageViButton: "button",
  note: "p",
  noteIcon: "span",
  noteText: "span",
  realtimeHint: "small",
  realtimeTitle: "strong",
  realtimeToggle: "input",
  reloadButton: "button",
  reloadIcon: "span",
  reloadText: "span",
  settingIcon: "span",
  settings: "section",
  statusCard: "section",
  statusDescription: "p",
  statusShield: "div",
  statusTitle: "strong",
  themeButton: "button",
  themeIcon: "span",
} as const;

type PopupElementId = keyof typeof popupElementTags;

type PopupElement<Id extends PopupElementId> = HTMLElementTagNameMap[
  (typeof popupElementTags)[Id]
];

function getElement<Id extends PopupElementId>(id: Id): PopupElement<Id> {
  const element: HTMLElement | null = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  if (element.tagName.toLowerCase() !== popupElementTags[id]) {
    throw new Error(
      `Element #${id} is <${element.tagName.toLowerCase()}>, expected <${popupElementTags[id]}>`,
    );
  }
  return element as PopupElement<Id>;
}

const brandIcon = getElement("brandIcon");
const realtimeToggle = getElement("realtimeToggle");
const reloadButton = getElement("reloadButton");
const reloadText = getElement("reloadText");
const reloadIcon = getElement("reloadIcon");
const statusCard = getElement("statusCard");
const statusTitle = getElement("statusTitle");
const statusDescription = getElement("statusDescription");
const statusShield = getElement("statusShield");
const settings = getElement("settings");
const settingIcon = getElement("settingIcon");
const realtimeTitle = getElement("realtimeTitle");
const realtimeHint = getElement("realtimeHint");
const feedback = getElement("feedback");
const feedbackIcon = getElement("feedbackIcon");
const feedbackText = getElement("feedbackText");
const noteIcon = getElement("noteIcon");
const noteText = getElement("noteText");
const brandSubtitle = getElement("brandSubtitle");
const languageSwitch = getElement("languageSwitch");
const languageViButton = getElement("languageViButton");
const languageEnButton = getElement("languageEnButton");
const themeButton = getElement("themeButton");
const themeIcon = getElement("themeIcon");

let currentState: ExtensionState | undefined;
let currentLanguage: Language = "vi";
let currentTheme: Theme = "system";
let isUpdating = false;
let isReloading = false;
let isReloadPending = false;

const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function getTranslation(): Translation {
  return translations[currentLanguage];
}

async function sendRequest(
  request: StateRequest,
): Promise<ExtensionStateResponse> {
  const raw: unknown = await chrome.runtime.sendMessage(request);
  const response: ExtensionResponse | undefined = parseExtensionResponse(raw);

  if (!response) {
    throw new Error(getTranslation().noResponse);
  }
  if (response.type === "error") {
    throw new Error(response.error);
  }
  if (response.type !== "state") {
    throw new Error(getTranslation().noResponse);
  }
  return response;
}

async function sendReloadRequest(): Promise<ExtensionReloadedResponse> {
  const raw: unknown = await chrome.runtime.sendMessage({
    type: messageTypes.reloadFacebookTabs,
  });
  const response: ExtensionResponse | undefined = parseExtensionResponse(raw);

  if (!response) {
    throw new Error(getTranslation().noResponse);
  }
  if (response.type === "error") {
    throw new Error(response.error);
  }
  if (response.type !== "reloaded") {
    throw new Error(getTranslation().noResponse);
  }
  return response;
}

function renderLanguage(): void {
  const text = getTranslation();
  document.documentElement.lang = currentLanguage;
  brandSubtitle.textContent = text.brandSubtitle;
  settings.setAttribute("aria-label", text.settingsLabel);
  languageSwitch.setAttribute("aria-label", text.languageLabel);
  realtimeTitle.textContent = text.realtimeTitle;
  realtimeHint.textContent = text.realtimeHint;
  reloadText.textContent = text.reload;
  noteText.textContent = text.note;

  const themeLabel =
    currentTheme === "system"
      ? `${text.themeLabel}: ${text.systemMode}`
      : currentTheme === "light"
        ? `${text.themeLabel}: ${text.lightMode}`
        : `${text.themeLabel}: ${text.darkMode}`;
  themeButton.setAttribute("aria-label", themeLabel);
  themeButton.title = themeLabel;

  const isVietnamese = currentLanguage === "vi";
  languageViButton.classList.toggle("is-active", isVietnamese);
  languageEnButton.classList.toggle("is-active", !isVietnamese);
  languageViButton.setAttribute("aria-pressed", String(isVietnamese));
  languageEnButton.setAttribute("aria-pressed", String(!isVietnamese));
}

function getResolvedTheme(): "light" | "dark" {
  return currentTheme === "system"
    ? colorSchemeQuery.matches
      ? "dark"
      : "light"
    : currentTheme;
}

function renderStaticIcons(): void {
  const brandSvg = lucide.createElement(lucide.icons.EyeOff, {
    width: 24,
    height: 24,
    "stroke-width": 2.1,
  });
  brandIcon.replaceChildren(brandSvg);

  const reloadSvg = lucide.createElement(lucide.icons.RotateCw, {
    width: 17,
    height: 17,
    "stroke-width": 2.2,
  });
  reloadIcon.replaceChildren(reloadSvg);

  const presenceSvg = lucide.createElement(lucide.icons.UserRoundX, {
    width: 20,
    height: 20,
    "stroke-width": 2,
  });
  settingIcon.replaceChildren(presenceSvg);

  const infoSvg = lucide.createElement(lucide.icons.Info, {
    width: 13,
    height: 13,
    "stroke-width": 2.2,
  });
  noteIcon.replaceChildren(infoSvg);
}

function createFeedbackIcons(): Record<FeedbackKind, SVGElement> {
  return {
    success: lucide.createElement(lucide.icons.Check, {
      width: 13,
      height: 13,
      "stroke-width": 2.6,
    }),
    pending: lucide.createElement(lucide.icons.Clock, {
      width: 13,
      height: 13,
      "stroke-width": 2.2,
    }),
    error: lucide.createElement(lucide.icons.CircleAlert, {
      width: 13,
      height: 13,
      "stroke-width": 2.2,
    }),
    info: lucide.createElement(lucide.icons.Info, {
      width: 13,
      height: 13,
      "stroke-width": 2.2,
    }),
  };
}

const feedbackIcons: Record<FeedbackKind, SVGElement> = createFeedbackIcons();

function renderTheme(animateIcon = false): void {
  const resolvedTheme = getResolvedTheme();
  document.documentElement.dataset.theme = resolvedTheme;
  const iconNode =
    currentTheme === "system"
      ? lucide.icons.Contrast
      : resolvedTheme === "light"
        ? lucide.icons.Sun
        : lucide.icons.Moon;
  const iconSvg = lucide.createElement(iconNode, {
    width: 16,
    height: 16,
    "stroke-width": 2,
  });

  themeIcon.getAnimations().forEach((animation) => animation.cancel());
  themeIcon.replaceChildren(iconSvg);

  if (animateIcon && !reducedMotionQuery.matches) {
    themeIcon.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      easing: "ease-out",
    });
  }

  renderLanguage();
}

function renderState(state: ExtensionState, animateThemeIcon = false): void {
  currentState = state;
  currentLanguage = state.language;
  currentTheme = state.theme;
  renderTheme(animateThemeIcon);

  realtimeToggle.checked = state.realtimeBlockingEnabled;

  renderControlState();

  const text = getTranslation();
  const isEnabled = state.realtimeBlockingEnabled;
  statusCard.dataset.enabled = String(isEnabled);
  statusTitle.textContent = isEnabled ? text.enabled : text.disabled;
  statusDescription.textContent = isEnabled
    ? text.realtimeBlocked
    : text.connected;

  const shieldIcon = isEnabled
    ? lucide.icons.ShieldCheck
    : lucide.icons.ShieldAlert;
  const shieldSvg = lucide.createElement(shieldIcon, {
    width: 32,
    height: 32,
    "stroke-width": 1.9,
  });
  statusShield.replaceChildren(shieldSvg);
}

function renderControlState(): void {
  const controlsDisabled = isUpdating || isReloading;
  realtimeToggle.disabled = controlsDisabled;
  languageViButton.disabled = controlsDisabled;
  languageEnButton.disabled = controlsDisabled;
  themeButton.disabled = controlsDisabled;
  reloadButton.disabled = controlsDisabled;
  reloadButton.classList.toggle("is-reloading", isReloading);
  reloadButton.classList.toggle("is-pending", isReloadPending && !isReloading);
}

function setUpdating(updating: boolean): void {
  isUpdating = updating;
  renderControlState();
}

function setReloading(reloading: boolean): void {
  isReloading = reloading;
  renderControlState();
}

function setReloadPending(pending: boolean): void {
  isReloadPending = pending;
  renderControlState();
}

function showFeedback(
  message: string,
  kind: FeedbackKind = "success",
): void {
  if (!message) {
    feedback.classList.remove("has-message");
    return;
  }

  feedbackText.textContent = message;
  feedback.dataset.kind = kind;
  feedbackIcon.replaceChildren(feedbackIcons[kind]);
  feedback.classList.add("has-message");
}

type TranslationKey = {
  [K in keyof Translation]: Translation[K] extends string ? K : never;
}[keyof Translation];

interface ApplySettingOptions {
  request: SettingRequest;
  onApplied: (state: ExtensionState) => void;
  errorKey: TranslationKey;
}

async function applySetting({
  request,
  onApplied,
  errorKey,
}: ApplySettingOptions): Promise<void> {
  setUpdating(true);
  showFeedback("");

  try {
    const response = await sendRequest(request);
    onApplied(response.state);
  } catch (error: unknown) {
    showFeedback(
      error instanceof Error ? error.message : getTranslation()[errorKey],
      "error",
    );
    if (currentState) {
      renderState(currentState);
    }
  } finally {
    setUpdating(false);
  }
}

function updateSetting(request: RealtimeBlockingRequest): Promise<void> {
  return applySetting({
    request,
    onApplied: (state) => {
      renderState(state);
      setReloadPending(true);
      showFeedback(getTranslation().reloadPending, "pending");
    },
    errorKey: "updateError",
  });
}

function changeLanguage(language: Language): Promise<void> {
  if (language === currentLanguage) {
    return Promise.resolve();
  }

  return applySetting({
    request: { type: messageTypes.setLanguage, language },
    onApplied: (state) => renderState(state),
    errorKey: "updateError",
  });
}

function changeTheme(theme: Theme): Promise<void> {
  if (theme === currentTheme) {
    return Promise.resolve();
  }

  return applySetting({
    request: { type: messageTypes.setTheme, theme },
    onApplied: (state) => renderState(state, true),
    errorKey: "updateError",
  });
}

realtimeToggle.addEventListener("change", () => {
  void updateSetting({
    type: messageTypes.setRealtimeBlocking,
    enabled: realtimeToggle.checked,
  });
});

languageViButton.addEventListener("click", () => {
  void changeLanguage("vi");
});

languageEnButton.addEventListener("click", () => {
  void changeLanguage("en");
});

themeButton.addEventListener("click", () => {
  const nextTheme: Theme =
    currentTheme === "system"
      ? "light"
      : currentTheme === "light"
        ? "dark"
        : "system";
  void changeTheme(nextTheme);
});

colorSchemeQuery.addEventListener("change", () => {
  if (currentTheme === "system") {
    renderTheme();
  }
});

reloadButton.addEventListener("click", () => {
  void (async () => {
    setReloading(true);
    showFeedback("");

    try {
      const response = await sendReloadRequest();
      renderState(response.state);
      const { reloadedTabCount, failedTabCount } = response;
      setReloadPending(failedTabCount > 0);
      const text = getTranslation();
      showFeedback(
        failedTabCount > 0
          ? text.reloadFailure(reloadedTabCount, failedTabCount)
          : reloadedTabCount > 0
            ? text.reloadSuccess(reloadedTabCount)
            : text.noTabs,
        failedTabCount > 0 ? "error" : reloadedTabCount > 0 ? "success" : "info",
      );
    } catch (error: unknown) {
      showFeedback(
        error instanceof Error ? error.message : getTranslation().reloadError,
        "error",
      );
    } finally {
      setReloading(false);
    }
  })();
});

void (async () => {
  renderStaticIcons();
  setUpdating(true);
  statusTitle.textContent = getTranslation().loading;

  try {
    const response = await sendRequest({ type: messageTypes.getState });
    renderState(response.state);
  } catch (error: unknown) {
    showFeedback(
      error instanceof Error ? error.message : getTranslation().stateError,
      "error",
    );
  } finally {
    setUpdating(false);
    document.documentElement.classList.remove("theme-initializing");
  }
})();
