import { parseSelectorsInput, Setting } from './setting.ts';
import {
  GetTextRequest,
  GetUrlRequest,
  MessageRequest,
  MessageResponse,
  StartPickRequest,
} from './message.ts';
import {
  clearPendingPickState,
  loadPendingPickedSelectors,
  loadPendingPick,
  loadStorageData,
  removePendingPick,
  savePendingPick,
  saveStorageData,
} from './storage.ts';
import type { PendingPick } from './storage.ts';

const DefaultSetting = new Setting(
  'defaultSetting',
  'Default (Title and URL on separate lines)',
  '*',
  [],
  '{Title}\n{URL}',
);
const TitleAndURLSetting = new Setting(
  'titleAndURLSetting',
  'Title and URL',
  '*',
  [],
  '{Title} {URL}',
);
const MarkdownSetting = new Setting(
  'markdownSetting',
  'Markdown',
  '*',
  [],
  '[{Title}]({URL})',
);

const PresetSettings = [DefaultSetting, TitleAndURLSetting, MarkdownSetting];

const isDebug = false;
const debugLog = (_message: string) => {
  // Intentionally silent: setting contents must not be written to the
  // console. Kept as a no-op so call sites do not need to change.
  if (isDebug) {
    // no-op
  }
};

const isPresetSetting = (id: string): boolean =>
  PresetSettings.some((setting) => setting.id === id);

class View {
  readonly customSettingView: HTMLElement;
  readonly preview: HTMLTextAreaElement;
  readonly updatePreviewButton: HTMLButtonElement;
  readonly settingSelector: HTMLSelectElement;
  readonly addSettingButton: HTMLButtonElement;
  readonly copyButton: HTMLButtonElement;
  readonly pickElementButton: HTMLButtonElement;
  readonly editInWindowButton: HTMLButtonElement;
  readonly urlPatterFilterEnabledCheckBox: HTMLInputElement;
  readonly settingNameInput: HTMLInputElement;
  readonly saveSettingButton: HTMLButtonElement;
  readonly selectorsInput: HTMLTextAreaElement;
  readonly urlPatternInput: HTMLInputElement;
  readonly formatInput: HTMLTextAreaElement;
  readonly savedMessage: HTMLElement;
  readonly copiedMessage: HTMLElement;

  constructor() {
    this.customSettingView = document.getElementById(
      'customSettingView',
    )!;
    this.preview = document.getElementById(
      'preview',
    ) as HTMLTextAreaElement;
    this.updatePreviewButton = document.getElementById(
      'updatePreviewButton',
    ) as HTMLButtonElement;
    this.settingSelector = document.getElementById(
      'settingSelector',
    ) as HTMLSelectElement;
    this.addSettingButton = document.getElementById(
      'addSettingButton',
    ) as HTMLButtonElement;
    this.pickElementButton = document.getElementById(
      'pickElementButton',
    ) as HTMLButtonElement;
    this.editInWindowButton = document.getElementById(
      'editInWindowButton',
    ) as HTMLButtonElement;
    this.urlPatterFilterEnabledCheckBox = document.getElementById(
      'urlPatterFilterEnabledCheckBox',
    ) as HTMLInputElement;
    this.copyButton = document.getElementById(
      'copyButton',
    ) as HTMLButtonElement;
    this.settingNameInput = document.getElementById(
      'settingName',
    ) as HTMLInputElement;
    this.saveSettingButton = document.getElementById(
      'saveSettingButton',
    ) as HTMLButtonElement;
    this.selectorsInput = document.getElementById(
      'selectors',
    ) as HTMLTextAreaElement;
    this.selectorsInput.style.whiteSpace = 'nowrap';
    this.selectorsInput.style.overflowX = 'auto';
    this.urlPatternInput = document.getElementById(
      'urlPattern',
    ) as HTMLInputElement;
    this.formatInput = document.getElementById(
      'format',
    ) as HTMLTextAreaElement;
    this.savedMessage = document.getElementById('savedMessage')!;
    this.copiedMessage = document.getElementById('copiedMessage')!;
  }

  showCopiedMessage() {
    this.showElement(this.copiedMessage);
  }

  showSavedMessage() {
    this.showElement(this.savedMessage);
  }

  private showElement(element: HTMLElement) {
    element.style.display = 'block';
    setTimeout(() => {
      element.style.display = 'none';
    }, 1500);
  }

  updateSettingValue(setting: Setting) {
    this.settingNameInput.value = setting.name;
    this.urlPatternInput.value = setting.urlPattern;
    this.selectorsInput.value = setting.selectors.join('\n');
    this.formatInput.value = setting.format;

    const isPreset = isPresetSetting(setting.id);

    this.customSettingView.style.display = isPreset ? 'none' : 'block';
    // The footer (with Save) is always visible; presets cannot be saved,
    // so disable the button for them instead of hiding the footer.
    this.saveSettingButton.disabled = isPreset;

    this.setOptionText(setting.id, setting.name);
  }

  // Updates the label of the <option> for a setting. Options carry no
  // id attribute (setting IDs come from user/imported data and must
  // never be used as DOM ids), so the option is found by value within
  // this view's own <select>.
  setOptionText(id: string, name: string) {
    for (const option of Array.from(this.settingSelector.options)) {
      if (option.value === id) {
        option.textContent = name;
        return;
      }
    }
  }
}

type Dictionary<KT extends string, VT> = Record<KT, VT>;

class StorageCache {
  settings: Setting[];
  lastSelectedSettingIdDict: Dictionary<string, string>;

  constructor(
    settings: Setting[],
    lastSelectedSettingIdDict: Dictionary<string, string>,
  ) {
    this.settings = settings;
    this.lastSelectedSettingIdDict = lastSelectedSettingIdDict;
  }
}

class Model {
  settings: Setting[];
  currentSetting: Setting;
  currentUrl: string;
  storageCache: StorageCache;

  constructor() {
    this.settings = [];
    this.currentSetting = DefaultSetting;
    this.currentUrl = '';
    this.storageCache = new StorageCache([], {});
  }

  async initialize() {
    this.storageCache = await this.loadStorageCacheFromChromeStorage();
    if (this.storageCache === undefined) {
      this.storageCache = new StorageCache([], {});
      await saveStorageData(this.storageCache);
    }
    // Convert plain objects loaded from storage into Setting class instances.
    const savedSettings = this.storageCache.settings ?? [];
    this.settings = savedSettings.map((s: Setting) =>
      new Setting(s.id, s.name, s.urlPattern, s.selectors, s.format)
    );

    this.settings.unshift(
      DefaultSetting,
      TitleAndURLSetting,
      MarkdownSetting,
    );
    this.currentSetting =
      this.settings.find((setting) => !isPresetSetting(setting.id)) ??
        DefaultSetting;
  }

  async loadSettings() {
    this.settings = await this.loadSettingsFromChromeStorage(null);
    this.currentSetting =
      this.settings.find((setting) => !isPresetSetting(setting.id)) ??
        DefaultSetting;
    debugLog(`Loaded settings: ${JSON.stringify(this.settings, null, 2)}`);
  }

  selectSetting(id: string) {
    this.currentSetting = this.getSettingById(id);
  }

  getSettingById(id: string): Setting {
    return this.settings.find((setting) => setting.id === id) ??
      Setting.createNew();
  }

  isCustomSetting(id: string) {
    return !PresetSettings.some((setting) => setting.id === id);
  }

  addSetting(setting: Setting) {
    this.settings.push(setting);
  }

  async loadStorageCacheFromChromeStorage() {
    // loadStorageData() always returns normalized data (settings and
    // the dict are guaranteed to exist, even on a fresh install).
    const data = await loadStorageData();
    const storageCache = new StorageCache(
      data.settings as unknown as Setting[],
      data.lastSelectedSettingIdDict,
    );
    debugLog('load storageCache from chrome storage');
    return storageCache;
  }

  async loadSettingsFromChromeStorage(url: string | null) {
    const storageCache = await this.loadStorageCacheFromChromeStorage();
    if (storageCache === undefined) {
      return [];
    }
    const readSettings = storageCache.settings;
    if (readSettings === undefined) {
      return [];
    }
    const settings = (readSettings as Setting[]).map((s) =>
      new Setting(s.id, s.name, s.urlPattern, s.selectors, s.format)
    );
    if (url !== null) {
      return settings.filter((s) => s.isUrlMatched(url));
    } else {
      return settings;
    }
  }

  async loadLastSelectedSettingIdFromChromeStorage(url: string) {
    // Return null if the URL is empty or not a valid HTTP/HTTPS URL.
    if (!url || !url.startsWith('http')) {
      return null;
    }

    const domain = new URL(url).hostname;
    const storageCache = await this.loadStorageCacheFromChromeStorage();
    if (storageCache === undefined) {
      return null;
    }
    const lastSelectedSettingId = storageCache.lastSelectedSettingIdDict
      ?.[domain];
    return lastSelectedSettingId;
  }

  async saveLastSelectedSettingIdToChromeStorage(
    url: string,
    settingId: string,
  ) {
    // Do not save if the URL is empty or not a valid HTTP/HTTPS URL.
    if (!url || !url.startsWith('http')) {
      return;
    }

    const domain = new URL(url).hostname;
    const storageCache = await this.loadStorageCacheFromChromeStorage();
    if (storageCache === undefined) {
      return;
    }
    if (!storageCache.lastSelectedSettingIdDict) {
      storageCache.lastSelectedSettingIdDict = {};
    }
    storageCache.lastSelectedSettingIdDict[domain] = settingId;
    try {
      // Write back only the dict, never the whole cache.
      await saveStorageData({
        lastSelectedSettingIdDict: storageCache.lastSelectedSettingIdDict,
      });
    } catch (error) {
      console.error(`Failed to save last selected setting: ${error}`);
    }
  }

  async saveCurrentSettingToChromeStorage() {
    const storageCache = await this.loadStorageCacheFromChromeStorage();
    if (storageCache === undefined) {
      return;
    }

    // Find the existing setting.
    const settingIndex = storageCache.settings.findIndex((s) =>
      s.id === this.currentSetting.id
    );

    if (settingIndex > -1) {
      // Update the existing setting.
      storageCache.settings[settingIndex] = this.currentSetting;
      debugLog(
        `overwrite setting: ${JSON.stringify(this.currentSetting, null, 2)}`,
      );
    } else {
      // Add a new setting.
      storageCache.settings.push(this.currentSetting);
      debugLog(
        `save new setting: ${JSON.stringify(this.currentSetting, null, 2)}`,
      );
    }

    // Write back only the settings list.
    await saveStorageData({ settings: storageCache.settings });
  }
}

class App {
  private view: View;
  private model: Model;

  constructor() {
    this.view = new View();
    this.model = new Model();
  }

  async initialize() {
    await this.model.initialize();

    // Apply selectors confirmed in the element picker (if any) before
    // choosing which setting to show.
    const pickedSettingId = await this.applyPendingPickedSelectors();

    const urlResponse = await this.sendMessageToTab<string>(
      new GetUrlRequest(),
    );
    this.model.currentUrl = urlResponse?.content ??
      (await this.getActiveTabUrl());
    debugLog(`Current URL: ${this.model.currentUrl}`);

    const lastSelectedId = await this.model
      .loadLastSelectedSettingIdFromChromeStorage(this.model.currentUrl);
    if (pickedSettingId) {
      this.model.selectSetting(pickedSettingId);
    } else if (lastSelectedId) {
      // Check if the found setting exists.
      const foundSetting = this.model.settings.find((s) =>
        s.id === lastSelectedId
      );
      if (foundSetting) {
        this.model.selectSetting(lastSelectedId);
      }
    } else {
      // If no setting is associated with the domain, select DefaultSetting.
      this.model.selectSetting(DefaultSetting.id);
    }

    this.view.updatePreviewButton.addEventListener(
      'click',
      () => this.updatePreview(),
    );

    this.view.settingSelector.addEventListener(
      'change',
      (event) => {
        const { target } = event;
        if (target instanceof HTMLSelectElement) {
          this.onSelectedSettingChanged(
            target.value,
          );
        }
      },
    );
    this.view.addSettingButton.addEventListener(
      'click',
      async () => {
        const setting = Setting.createNew();
        setting.urlPattern = this.model.currentUrl;
        this.model.addSetting(setting);
        this.model.currentSetting = setting;
        await this.updateSettingSelector();
        this.view.updateSettingValue(setting);
      },
    );

    this.view.pickElementButton.addEventListener(
      'click',
      () => this.startElementPick(),
    );

    this.view.editInWindowButton.addEventListener('click', async () => {
      const settingId = this.model.currentSetting.id;
      if (isPresetSetting(settingId)) {
        alert('Preset settings cannot be edited in a new window.');
        return;
      }
      // Persist first (including a brand-new, not yet saved setting):
      // the settings window loads the setting from storage, so without
      // saving it would report "not found".
      this.syncCurrentSettingFromForm();
      try {
        await this.model.saveCurrentSettingToChromeStorage();
      } catch (error) {
        console.error(`Failed to save setting before editing: ${error}`);
        alert('Failed to save the setting.');
        return;
      }
      const url = chrome.runtime.getURL(`settings.html?id=${settingId}`);
      chrome.windows.create({
        url: url,
        type: 'popup',
        width: 640,
        height: 480,
      });
    });

    this.view.urlPatterFilterEnabledCheckBox.addEventListener(
      'change',
      () => {
        this.updateSettingSelector();
      },
    );

    await this.updateSettingSelector();

    this.view.copyButton.addEventListener(
      'click',
      () => this.copyToClipboard(),
    );

    this.view.saveSettingButton.addEventListener(
      'click',
      () => this.saveCurrentSetting(),
    );

    // All form fields are mirrored into the model as they are edited,
    // using the same normalization as saving, so the preview always
    // works on exactly what would be saved.
    this.view.selectorsInput.addEventListener(
      'input',
      (event) => {
        const { target } = event;
        if (target instanceof HTMLTextAreaElement) {
          this.model.currentSetting.selectors = parseSelectorsInput(
            target.value,
          );
        }
      },
    );

    this.view.formatInput.addEventListener(
      'input',
      (event) => {
        const { target } = event;
        if (target instanceof HTMLTextAreaElement) {
          this.model.currentSetting.format = target.value;
        }
      },
    );

    this.view.settingNameInput.addEventListener(
      'input',
      (event) => {
        const { target } = event;
        if (target instanceof HTMLInputElement) {
          this.model.currentSetting.name = target.value;
        }
      },
    );

    this.view.urlPatternInput.addEventListener(
      'input',
      (event) => {
        const { target } = event;
        if (target instanceof HTMLInputElement) {
          this.model.currentSetting.urlPattern = target.value;
        }
      },
    );

    this.onSelectedSettingChanged(this.model.currentSetting.id);

    debugLog('App initialized');
  }

  async updateSettingSelector() {
    this.view.settingSelector.innerHTML = '';

    const isFilterEnabled = this.view.urlPatterFilterEnabledCheckBox.checked;
    let filteredSettings = this.model.settings;

    if (isFilterEnabled) {
      filteredSettings = this.model.settings.filter(
        (s) => isPresetSetting(s.id) || s.isUrlMatched(this.model.currentUrl),
      );
    }

    for (const setting of filteredSettings) {
      const option = this.addSettingSelector(setting.id, setting.name);
      option.selected = setting.id === this.model.currentSetting.id;
    }

    this.view.settingSelector.value = this.model.currentSetting.id;
  }

  addSettingSelector(id: string, name: string): HTMLOptionElement {
    debugLog(`addSettingSelector: id = ${id}, name = ${name}`);
    if (!(this.view.settingSelector instanceof HTMLSelectElement)) {
      throw new Error(
        'settingSelector is not HTMLSelectElement',
      );
    }
    const option = document.createElement('option');
    option.value = id;
    option.innerText = name;
    this.view.settingSelector.appendChild(option);
    return option;
  }

  async onSelectedSettingChanged(id: string) {
    this.model.selectSetting(id);
    debugLog(
      `Selected setting: ${id} -> ${
        JSON.stringify(this.model.currentSetting, null, 2)
      }`,
    );
    this.view.updateSettingValue(this.model.currentSetting);
    await this.updatePreview();
    await this.model.saveLastSelectedSettingIdToChromeStorage(
      this.model.currentUrl,
      id,
    );
  }

  // Apply selectors the element picker confirmed while the popup was
  // closed. Returns the setting ID to select, or null when there was
  // nothing applicable. Pending state is always cleared; picks whose
  // target setting no longer exists are discarded.
  async applyPendingPickedSelectors(): Promise<string | null> {
    const picked = await loadPendingPickedSelectors();
    if (picked.length === 0) {
      if ((await loadPendingPick()) !== null) {
        // A pick was started but never confirmed (e.g. browser closed).
        await removePendingPick();
      }
      return null;
    }

    let appliedSettingId: string | null = null;
    for (const entry of picked) {
      const setting = this.model.settings.find((s) =>
        s.id === entry.settingId && !isPresetSetting(s.id)
      );
      if (!setting) {
        continue; // Target setting was deleted: discard this pick.
      }
      if (!setting.selectors.includes(entry.selector)) {
        setting.selectors.push(entry.selector);
      }
      // Mirror the change into the storage copy so it can be persisted.
      const stored = this.model.storageCache.settings.find((s) =>
        s.id === entry.settingId
      );
      if (stored) {
        stored.selectors = setting.selectors;
      }
      appliedSettingId = entry.settingId;
    }

    if (appliedSettingId !== null) {
      try {
        await saveStorageData({
          settings: this.model.storageCache.settings,
        });
      } catch (error) {
        console.error(`Failed to save picked selector: ${error}`);
      }
    }
    await clearPendingPickState();
    return appliedSettingId;
  }

  async startElementPick() {
    // Presets have no editable selectors: create a new custom setting
    // for the current URL first (same behaviour as the + button).
    if (isPresetSetting(this.model.currentSetting.id)) {
      const setting = Setting.createNew();
      setting.urlPattern = this.model.currentUrl;
      this.model.addSetting(setting);
      this.model.currentSetting = setting;
    } else {
      // Take over any unsaved edits shown in the form.
      this.syncCurrentSettingFromForm();
    }

    // The target setting must exist in storage when the popup reopens,
    // otherwise the confirmed pick would have nowhere to go.
    try {
      await this.model.saveCurrentSettingToChromeStorage();
    } catch (error) {
      console.error(`Failed to save setting before picking: ${error}`);
      alert('Failed to save the setting.');
      return;
    }

    const pendingPick: PendingPick = {
      settingId: this.model.currentSetting.id,
    };
    await savePendingPick(pendingPick);

    const response = await this.sendMessageToTab<null>(
      new StartPickRequest(this.model.currentSetting.id),
    );
    if (!response || !response.isSuccess) {
      // The content script is not available on this page.
      await removePendingPick();
      alert(
        'Could not start the element picker on this page.',
      );
      return;
    }

    window.close();
  }

  async copyToClipboard() {
    const text = await this.getText();
    if (text === null) {
      // No response from the content script (e.g. chrome:// pages,
      // the Web Store or PDF viewer): do not copy an empty string.
      alert(
        'Could not read this page. Copying is not available on this page.',
      );
      return;
    }
    // Also reflect in the preview.
    this.view.preview.value = text;
    try {
      await navigator.clipboard.writeText(text);
      this.view.showCopiedMessage();
    } catch (error) {
      console.error(`Failed to write to clipboard: ${error}`);
      alert('Failed to copy to the clipboard.');
    }
  }

  // Copies the form's current values into the model, applying the
  // shared selector parsing. Used by every path that persists the
  // setting (Save button, Edit in Window, element picker).
  syncCurrentSettingFromForm() {
    this.model.currentSetting.name = this.view.settingNameInput.value;
    this.model.currentSetting.urlPattern = this.view.urlPatternInput.value;
    this.model.currentSetting.selectors = parseSelectorsInput(
      this.view.selectorsInput.value,
    );
    this.model.currentSetting.format = this.view.formatInput.value;
  }

  async saveCurrentSetting() {
    this.syncCurrentSettingFromForm();
    try {
      await this.model.saveCurrentSettingToChromeStorage();
    } catch (error) {
      console.error(`Failed to save setting: ${error}`);
      alert('Failed to save the setting.');
      return;
    }
    this.view.setOptionText(
      this.model.currentSetting.id,
      this.model.currentSetting.name,
    );

    this.view.showSavedMessage();
  }

  showMessage(message: HTMLElement) {
    message.style.display = 'block';
    setTimeout(() => {
      message.style.display = 'none';
    }, 1500);
  }

  async updatePreview() {
    const text = await this.getText() ?? '';
    this.view.preview.value = text;
    debugLog(`Preview updated: ${text}`);
    requestAnimationFrame(() => {
      this.view.preview.value = text;
      debugLog(`Preview updated in rAF: ${text}`);
    });
  }

  async getText(): Promise<string | null> {
    const request = new GetTextRequest(this.model.currentSetting);
    const response = await this.sendMessageToTab<string>(request);
    if (!response || !response.isSuccess) {
      // No response, or the content script reported an error.
      return null;
    }
    debugLog('GetText succeeded');
    return response.content ?? '';
  }

  // Fallback for the current URL, used when the content script does
  // not answer (e.g. a tab that was open before an extension update,
  // so no content script was injected into it). The activeTab
  // permission makes the active tab's URL available here.
  async getActiveTabUrl(): Promise<string> {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tabs[0]?.url ?? '';
    } catch (error) {
      console.error(`Failed to query the active tab: ${error}`);
      return '';
    }
  }

  async sendMessageToTab<T>(
    request: MessageRequest,
  ): Promise<MessageResponse<T> | null> {
    debugLog(`sendMessageToTab: request = ${JSON.stringify(request, null, 2)}`);
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs.length === 0) {
      return null;
    }
    const tabId = tabs[0].id;
    if (tabId === undefined) {
      return null;
    }

    try {
      const response: MessageResponse<T> = await chrome.tabs.sendMessage(
        tabId,
        request,
      );
      if (response.errorMessage) {
        console.error(`Error: ${response.errorMessage}`);
      }
      debugLog(`response = ${JSON.stringify(response, null, 2)}`);
      return response;
    } catch (error) {
      console.error(`Error sending message: ${error}`);
      return null;
    }
  }
}

export { App };
