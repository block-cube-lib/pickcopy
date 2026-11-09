import { Setting } from './setting.ts';
import {
  GetTextRequest,
  GetUrlRequest,
  MessageRequest,
  MessageResponse,
} from './message.ts';
import { loadStorageData, saveStorageData } from './storage.ts';

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

    const selectOption = document.getElementById(
      setting.id,
    ) as HTMLOptionElement;
    if (selectOption) {
      selectOption.innerText = setting.name;
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
    const storageCache = await loadStorageData() as StorageCache;
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
      await saveStorageData(storageCache);
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

    await saveStorageData(storageCache);
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

    const urlResponse = await this.sendMessageToTab<string>(
      new GetUrlRequest(),
    );
    this.model.currentUrl = urlResponse?.content ?? '';
    debugLog(`Current URL: ${this.model.currentUrl}`);

    const lastSelectedId = await this.model
      .loadLastSelectedSettingIdFromChromeStorage(this.model.currentUrl);
    if (lastSelectedId) {
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

    this.view.editInWindowButton.addEventListener('click', () => {
      const settingId = this.model.currentSetting.id;
      if (isPresetSetting(settingId)) {
        alert('Preset settings cannot be edited in a new window.');
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

    this.view.selectorsInput.addEventListener(
      'input',
      (event) => {
        const { target } = event;
        if (target instanceof HTMLTextAreaElement) {
          this.model.currentSetting.selectors = target.value.split('\n');
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
    option.id = id;
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

  async saveCurrentSetting() {
    this.model.currentSetting.name = this.view.settingNameInput.value;
    this.model.currentSetting.urlPattern = this.view.urlPatternInput.value;
    this.model.currentSetting.selectors = this.view.selectorsInput.value
      .split('\n')
      .filter((s) => s.trim() !== '');
    this.model.currentSetting.format = this.view.formatInput.value;
    try {
      await this.model.saveCurrentSettingToChromeStorage();
    } catch (error) {
      console.error(`Failed to save setting: ${error}`);
      alert('Failed to save the setting.');
      return;
    }
    const option = this.view.settingSelector.options.namedItem(
      this.model.currentSetting.id,
    );
    if (option) {
      option.innerText = this.model.currentSetting.name;
    }

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
