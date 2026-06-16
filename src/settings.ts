import { Setting } from './setting.ts';

type StorageCache = {
  settings: Setting[];
  lastSelectedSettingIdDict: { [key: string]: string };
};

class SettingsPage {
  private settingId: string;
  private setting: Setting | null = null;

  private nameInput = document.getElementById('settingName') as HTMLInputElement;
  private selectorsInput = document.getElementById('selectors') as HTMLTextAreaElement;
  private formatInput = document.getElementById('format') as HTMLTextAreaElement;
  private urlPatternInput = document.getElementById('urlPattern') as HTMLInputElement;
  private saveButton = document.getElementById('saveButton') as HTMLButtonElement;
  private deleteButton = document.getElementById('deleteButton') as HTMLButtonElement;
  private savedMessage = document.getElementById('savedMessage') as HTMLElement;

  constructor() {
    const urlParams = new URLSearchParams(window.location.search);
    this.settingId = urlParams.get('id')!;
    if (!this.settingId) {
      document.body.innerHTML = '<h1>Error: No setting ID provided.</h1>';
      return;
    }
    this.initialize();
  }

  private async initialize() {
    await this.loadSetting();
    this.populateForm();
    this.saveButton.addEventListener('click', () => this.saveSetting());
    this.deleteButton.addEventListener('click', () => this.deleteSetting());
  }

  private async loadSetting() {
    const cache: StorageCache = await chrome.storage.sync.get(null);
    const savedSettings = cache.settings ?? [];
    this.setting = savedSettings.find(s => s.id === this.settingId) ?? null;
  }

  private populateForm() {
    if (!this.setting) {
      document.body.innerHTML = `<h1>Error: Setting with ID "${this.settingId}" not found.</h1>`;
      return;
    }
    this.nameInput.value = this.setting.name;
    this.selectorsInput.value = this.setting.selectors.join('\n');
    this.formatInput.value = this.setting.format;
    this.urlPatternInput.value = this.setting.urlPattern;
  }

  private async saveSetting() {
    if (!this.setting) return;

    const cache: StorageCache = await chrome.storage.sync.get(null);
    const settings = cache.settings ?? [];
    const settingIndex = settings.findIndex(s => s.id === this.settingId);

    if (settingIndex > -1) {
      const updatedSetting = new Setting(
        this.settingId,
        this.nameInput.value,
        this.urlPatternInput.value,
        this.selectorsInput.value.split('\n').filter(s => s.trim() !== ''),
        this.formatInput.value
      );
      settings[settingIndex] = updatedSetting;
      cache.settings = settings;
      await chrome.storage.sync.set(cache);
      this.showSavedMessage();
    }
  }

  private async deleteSetting() {
    if (!confirm(`Are you sure you want to delete the setting "${this.setting?.name}"?`)) {
      return;
    }
    const cache: StorageCache = await chrome.storage.sync.get(null);
    cache.settings = (cache.settings ?? []).filter(s => s.id !== this.settingId);
    await chrome.storage.sync.set(cache);
    window.close();
  }

  private showSavedMessage() {
    this.savedMessage.style.display = 'block';
    setTimeout(() => {
      this.savedMessage.style.display = 'none';
    }, 2000);
  };
}

new SettingsPage();
