// Storage access for settings.
//
// Settings used to live in chrome.storage.sync, whose per-item quota
// (8 KB) is easy to exceed once several settings are saved. They now live
// in chrome.storage.local. On first load, if local storage has no data
// but sync still holds data from an older version, that data is migrated
// to local storage once (sync data is left untouched).

type StoredData = {
  settings?: unknown[];
  lastSelectedSettingIdDict?: { [key: string]: string };
  [key: string]: unknown;
};

// Element-picker hand-off via chrome.storage.local:
// the popup stores `pendingPick` before closing, the content script
// appends confirmed picks to `pendingPickedSelectors`, and the next
// popup session applies and clears both keys.
type PendingPick = {
  settingId: string;
};

type PendingPickedSelector = {
  settingId: string;
  selector: string;
};

const hasStoredData = (data: StoredData): boolean =>
  (Array.isArray(data.settings) && data.settings.length > 0) ||
  (data.lastSelectedSettingIdDict !== undefined &&
    Object.keys(data.lastSelectedSettingIdDict).length > 0);

async function loadStorageData(): Promise<StoredData> {
  const localData = (await chrome.storage.local.get(null)) as unknown as StoredData;
  if (hasStoredData(localData)) {
    return localData;
  }

  // One-time migration from chrome.storage.sync (pre-1.0 storage).
  const syncData = (await chrome.storage.sync.get(null)) as unknown as StoredData;
  if (hasStoredData(syncData)) {
    await chrome.storage.local.set(syncData);
    return syncData;
  }

  return localData;
}

async function saveStorageData(data: object): Promise<void> {
  // Let failures propagate so callers can notify the user.
  await chrome.storage.local.set(data as { [key: string]: unknown });
}

export { loadStorageData, saveStorageData };
export type { PendingPick, PendingPickedSelector, StoredData };
