import { Setting } from './setting.ts';
import { loadStorageData, saveStorageData } from './storage.ts';

type StorageCache = {
  settings: Setting[];
  lastSelectedSettingIdDict: { [key: string]: string };
};

class SettingsPage {
  private settingId: string | null = null;
  private setting: Setting | null = null;

  // View Containers
  private editSettingView = document.getElementById(
    'editSettingView',
  ) as HTMLElement;
  private allSettingsView = document.getElementById(
    'allSettingsView',
  ) as HTMLElement;

  // Edit View Elements
  private nameInput = document.getElementById(
    'settingName',
  ) as HTMLInputElement;
  private selectorsInput = document.getElementById(
    'selectors',
  ) as HTMLTextAreaElement;
  private formatInput = document.getElementById(
    'format',
  ) as HTMLTextAreaElement;
  private urlPatternInput = document.getElementById(
    'urlPattern',
  ) as HTMLInputElement;
  private saveButton = document.getElementById(
    'saveButton',
  ) as HTMLButtonElement;
  private deleteButton = document.getElementById(
    'deleteButton',
  ) as HTMLButtonElement;
  private savedMessage = document.getElementById('savedMessage') as HTMLElement;

  // All Settings View Elements
  private settingsList = document.getElementById('settingsList') as HTMLElement;
  private exportSettingsButton = document.getElementById(
    'exportSettings',
  ) as HTMLButtonElement;
  private importFileInput = document.getElementById(
    'importFile',
  ) as HTMLInputElement;
  private importFileButton = document.getElementById(
    'importFileButton',
  ) as HTMLButtonElement;
  private importPasteButton = document.getElementById(
    'importPasteButton',
  ) as HTMLButtonElement;
  private importTextArea = document.getElementById(
    'importTextArea',
  ) as HTMLTextAreaElement;

  constructor() {
    const urlParams = new URLSearchParams(window.location.search);
    this.settingId = urlParams.get('id');
    this.initialize();
  }

  private async initialize() {
    if (this.settingId) {
      // Show Edit Setting View
      this.editSettingView.style.display = 'block';
      this.allSettingsView.style.display = 'none';

      await this.loadSetting();
      this.populateForm();
      this.saveButton.addEventListener('click', () => this.saveSetting());
      this.deleteButton.addEventListener('click', () => this.deleteSetting());
    } else {
      // Show All Settings View
      this.editSettingView.style.display = 'none';
      this.allSettingsView.style.display = 'block';

      await this.loadAllSettingsList();
      this.exportSettingsButton.addEventListener(
        'click',
        () => this.exportSettings(),
      );
      this.importFileButton.addEventListener(
        'click',
        () => this.importFileInput.click(),
      );
      this.importFileInput.addEventListener(
        'change',
        (e) => this.handleFileImport(e),
      );
      this.importPasteButton.addEventListener('click', () => {
        this.importTextArea.style.display =
          this.importTextArea.style.display === 'none' ? 'block' : 'none';
      });
      this.importTextArea.addEventListener(
        'change',
        (e) => this.handleTextImport(e),
      );
    }
  }

  // === Edit Setting View Implementation ===

  private async loadSetting() {
    const cache = await loadStorageData() as StorageCache;
    const savedSettings = cache.settings ?? [];
    this.setting = savedSettings.find((s) => s.id === this.settingId) ?? null;
  }

  private populateForm() {
    if (!this.setting) {
      const error = document.createElement('h1');
      error.textContent =
        `Error: Setting with ID "${this.settingId}" not found.`;
      document.body.replaceChildren(error);
      return;
    }
    this.nameInput.value = this.setting.name;
    this.selectorsInput.value = this.setting.selectors.join('\n');
    this.formatInput.value = this.setting.format;
    this.urlPatternInput.value = this.setting.urlPattern;
  }

  private async saveSetting() {
    if (!this.setting || !this.settingId) return;

    const cache = await loadStorageData() as StorageCache;
    const settings = cache.settings ?? [];
    const settingIndex = settings.findIndex((s) => s.id === this.settingId);

    if (settingIndex > -1) {
      const updatedSetting = new Setting(
        this.settingId,
        this.nameInput.value,
        this.urlPatternInput.value,
        this.selectorsInput.value.split('\n').filter((s) => s.trim() !== ''),
        this.formatInput.value,
      );
      settings[settingIndex] = updatedSetting;
      cache.settings = settings;
      try {
        await saveStorageData(cache);
      } catch (e) {
        alert(`Failed to save the setting: ${e}`);
        return;
      }
      this.showSavedMessage();
    }
  }

  private async deleteSetting() {
    if (
      !confirm(
        `Are you sure you want to delete the setting "${this.setting?.name}"?`,
      )
    ) {
      return;
    }
    const cache = await loadStorageData() as StorageCache;
    cache.settings = (cache.settings ?? []).filter((s) =>
      s.id !== this.settingId
    );

    // also clean up last selected setting if it was this one
    if (cache.lastSelectedSettingIdDict && this.settingId) {
      for (const domain of Object.keys(cache.lastSelectedSettingIdDict)) {
        if (cache.lastSelectedSettingIdDict[domain] === this.settingId) {
          delete cache.lastSelectedSettingIdDict[domain];
        }
      }
    }

    try {
      await saveStorageData(cache);
    } catch (e) {
      alert(`Failed to delete the setting: ${e}`);
      return;
    }
    window.close();
  }

  private showSavedMessage() {
    this.savedMessage.style.display = 'block';
    setTimeout(() => {
      this.savedMessage.style.display = 'none';
    }, 2000);
  }

  // === All Settings View Implementation ===

  private async loadAllSettingsList() {
    const cache = await loadStorageData() as StorageCache;
    const settings = cache.settings ?? [];
    this.settingsList.innerHTML = '';

    if (settings.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText =
        'color: #666; font-style: italic; margin-bottom: 15px;';
      empty.textContent = 'No custom settings found.';
      this.settingsList.appendChild(empty);
      return;
    }

    for (const setting of settings) {
      const div = document.createElement('div');
      div.className = 'setting-item';

      const title = document.createElement('div');
      title.className = 'setting-item-title';
      title.innerText = setting.name || '(Unnamed)';

      const makeDetail = (label: string, value: string) => {
        const div = document.createElement('div');
        div.className = 'setting-item-detail';
        const strong = document.createElement('strong');
        strong.textContent = `${label}:`;
        div.appendChild(strong);
        div.appendChild(document.createTextNode(` ${value}`));
        return div;
      };

      const pattern = makeDetail('Pattern', setting.urlPattern || '*');
      const selectors = makeDetail(
        'Selectors',
        setting.selectors.join(', ') || '(None)',
      );
      const format = makeDetail('Format', setting.format);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerText = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete "${setting.name}"?`)) {
          const updatedSettings = settings.filter((s) => s.id !== setting.id);
          cache.settings = updatedSettings;

          // also clean up last selected setting if it was this one
          if (cache.lastSelectedSettingIdDict) {
            for (const domain of Object.keys(cache.lastSelectedSettingIdDict)) {
              if (cache.lastSelectedSettingIdDict[domain] === setting.id) {
                delete cache.lastSelectedSettingIdDict[domain];
              }
            }
          }

          try {
            await saveStorageData(cache);
          } catch (e) {
            alert(`Failed to delete the setting: ${e}`);
            return;
          }
          this.loadAllSettingsList();
        }
      });

      div.appendChild(title);
      div.appendChild(pattern);
      div.appendChild(selectors);
      div.appendChild(format);
      div.appendChild(deleteBtn);
      this.settingsList.appendChild(div);
    }
  }

  private async exportSettings() {
    const cache = await loadStorageData();
    const dataStr = 'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(cache, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'magic_copy_settings.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  private handleFileImport(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result as string;
      const modeInput = prompt(
        "Enter import mode: 'overwrite', 'newId', or 'ignore'",
        'overwrite',
      );
      const mode = modeInput?.trim() as 'overwrite' | 'newId' | 'ignore' | null;
      if (mode && ['overwrite', 'newId', 'ignore'].includes(mode)) {
        this.importSettings(json, mode);
      } else if (modeInput !== null) {
        alert('Invalid mode. Import cancelled.');
      }
    };
    reader.readAsText(file);
  }

  private handleTextImport(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    const json = target.value;
    if (!json.trim()) return;

    const modeInput = prompt(
      "Enter import mode: 'overwrite', 'newId', or 'ignore'",
      'overwrite',
    );
    const mode = modeInput?.trim() as 'overwrite' | 'newId' | 'ignore' | null;
    if (mode && ['overwrite', 'newId', 'ignore'].includes(mode)) {
      this.importSettings(json, mode);
      this.importTextArea.value = '';
      this.importTextArea.style.display = 'none';
    } else if (modeInput !== null) {
      alert('Invalid mode. Import cancelled.');
    }
  }

  private async importSettings(
    json: string,
    mode: 'overwrite' | 'newId' | 'ignore',
  ) {
    try {
      const importedData = JSON.parse(json);
      let importedSettings: Setting[] = [];

      if (Array.isArray(importedData)) {
        importedSettings = importedData;
      } else if (importedData && Array.isArray(importedData.settings)) {
        importedSettings = importedData.settings;
      } else if (importedData && typeof importedData === 'object') {
        // Old format: { [id]: { pattern/urlPattern, name, selectors, format } }
        for (const [id, value] of Object.entries(importedData)) {
          if (value && typeof value === 'object') {
            const v = value as any;
            importedSettings.push({
              id: id,
              name: v.name || '',
              urlPattern: v.urlPattern || v.pattern || '',
              selectors: v.selectors || [],
              format: v.format || '',
            } as Setting);
          }
        }
      }

      if (importedSettings.length === 0) {
        alert('No settings found in the imported data.');
        return;
      }

      const cache = await loadStorageData() as StorageCache;
      const currentSettings = cache.settings ?? [];
      const currentSettingsMap = new Map(currentSettings.map((s) => [s.id, s]));

      for (const imported of importedSettings) {
        const existing = currentSettingsMap.get(imported.id);
        if (existing) {
          if (mode === 'overwrite') {
            currentSettingsMap.set(imported.id, imported);
          } else if (mode === 'newId') {
            const newId = crypto.randomUUID();
            currentSettingsMap.set(newId, {
              ...imported,
              id: newId,
            } as Setting);
          }
          // if 'ignore', do nothing
        } else {
          currentSettingsMap.set(imported.id, imported);
        }
      }

      cache.settings = Array.from(currentSettingsMap.values());
      await saveStorageData(cache);
      alert('Settings imported successfully!');
      this.loadAllSettingsList();
    } catch (e) {
      alert(`Failed to import settings: ${e}`);
    }
  }
}

new SettingsPage();
