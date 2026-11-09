// Storage access for settings.
//
// Settings used to live in chrome.storage.sync, whose per-item quota
// (8 KB) is easy to exceed once several settings are saved. They now live
// in chrome.storage.local. On first load, if local storage has no data
// but sync still holds data from an older version, that data is migrated
// to local storage once (sync data is left untouched).
//
// Only the keys owned by this module (settings,
// lastSelectedSettingIdDict, migratedFromSync) are ever read or written
// here. Reading everything with get(null) and writing the whole object
// back used to race with, and could clobber, unrelated keys kept in the
// same storage area (such as the element picker's pending state), so all
// access is scoped to explicit key lists. A `migratedFromSync` flag in
// local storage records that the one-time sync -> local migration has
// been decided, so deleting every setting does not resurrect the old
// sync data on the next start.

// A setting as stored (plain object form of the Setting class).
type StoredSetting = {
  id: string;
  name: string;
  urlPattern: string;
  selectors: string[];
  format: string;
  [key: string]: unknown;
};

// Normalized view of the settings data. The arrays/objects are ALWAYS
// present (never undefined), even on a fresh install, so callers can
// push into `settings` or read from the dict without guards.
type StoredData = {
  settings: StoredSetting[];
  lastSelectedSettingIdDict: { [key: string]: string };
  migratedFromSync: boolean;
};

// Keys owned by this module, in one place.
const DATA_KEYS = [
  'settings',
  'lastSelectedSettingIdDict',
  'migratedFromSync',
] as const;

const isRecord = (value: unknown): value is { [key: string]: unknown } =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Coerce arbitrary stored data into the normalized shape, guaranteeing
// settings: [] and lastSelectedSettingIdDict: {} when data is missing
// or malformed.
function normalizeStoredData(raw: unknown): StoredData {
  const record = isRecord(raw) ? raw : {};
  const settings = Array.isArray(record.settings)
    ? (record.settings as StoredSetting[])
    : [];
  const dict: { [key: string]: string } = {};
  if (isRecord(record.lastSelectedSettingIdDict)) {
    for (const [key, value] of Object.entries(
      record.lastSelectedSettingIdDict,
    )) {
      if (typeof value === 'string') {
        dict[key] = value;
      }
    }
  }
  return {
    settings,
    lastSelectedSettingIdDict: dict,
    migratedFromSync: record.migratedFromSync === true,
  };
}

const hasStoredData = (data: StoredData): boolean =>
  data.settings.length > 0 ||
  Object.keys(data.lastSelectedSettingIdDict).length > 0;

async function loadStorageData(): Promise<StoredData> {
  const localData = normalizeStoredData(
    await chrome.storage.local.get([...DATA_KEYS]),
  );
  if (localData.migratedFromSync) {
    return localData;
  }

  // Migration has not been decided yet. Do it at most once: whatever the
  // outcome, persist the flag (without touching the data keys unless
  // there is something to migrate) so the sync data is never re-imported.
  let syncData: StoredData | null = null;
  try {
    syncData = normalizeStoredData(
      await chrome.storage.sync.get(['settings', 'lastSelectedSettingIdDict']),
    );
  } catch (error) {
    // Sync may be unavailable (e.g. profile restrictions). Treat it as
    // empty rather than breaking every storage load.
    console.warn(`Failed to read chrome.storage.sync for migration: ${error}`);
    syncData = null;
  }

  if (!hasStoredData(localData) && syncData && hasStoredData(syncData)) {
    const migrated: StoredData = { ...syncData, migratedFromSync: true };
    await chrome.storage.local.set({
      settings: migrated.settings,
      lastSelectedSettingIdDict: migrated.lastSelectedSettingIdDict,
      migratedFromSync: true,
    });
    return migrated;
  }

  await chrome.storage.local.set({ migratedFromSync: true });
  return { ...localData, migratedFromSync: true };
}

// Writes only the data keys that are actually present in `data`; other
// keys (including the picker's pending state) are never written back,
// and keys absent from `data` keep their stored values. Failures
// propagate so callers can notify the user.
async function saveStorageData(data: object): Promise<void> {
  const record = data as { [key: string]: unknown };
  const toWrite: { [key: string]: unknown } = {};
  if ('settings' in record) {
    toWrite.settings = Array.isArray(record.settings)
      ? record.settings
      : [];
  }
  if ('lastSelectedSettingIdDict' in record) {
    toWrite.lastSelectedSettingIdDict = isRecord(
        record.lastSelectedSettingIdDict,
      )
      ? record.lastSelectedSettingIdDict
      : {};
  }
  if ('migratedFromSync' in record) {
    toWrite.migratedFromSync = record.migratedFromSync === true;
  }
  if (Object.keys(toWrite).length > 0) {
    await chrome.storage.local.set(toWrite);
  }
}

// === Element-picker hand-off via chrome.storage.local ===
//
// The popup stores `pendingPick` before closing, the content script
// appends confirmed picks to `pendingPickedSelectors`, and the next
// popup session applies and clears both keys. These keys are managed
// only through the helpers below, never via load/saveStorageData.

type PendingPick = {
  settingId: string;
};

type PendingPickedSelector = {
  settingId: string;
  selector: string;
};

const PENDING_KEYS = ['pendingPick', 'pendingPickedSelectors'] as const;

async function loadPendingPick(): Promise<PendingPick | null> {
  const data = await chrome.storage.local.get('pendingPick');
  const pending = data.pendingPick as PendingPick | undefined;
  return pending && typeof pending.settingId === 'string' ? pending : null;
}

async function savePendingPick(pending: PendingPick): Promise<void> {
  await chrome.storage.local.set({ pendingPick: pending });
}

async function removePendingPick(): Promise<void> {
  await chrome.storage.local.remove('pendingPick');
}

async function loadPendingPickedSelectors(): Promise<
  PendingPickedSelector[]
> {
  const data = await chrome.storage.local.get('pendingPickedSelectors');
  const picked = data.pendingPickedSelectors;
  if (!Array.isArray(picked)) {
    return [];
  }
  return picked.filter(
    (entry): entry is PendingPickedSelector =>
      isRecord(entry) &&
      typeof entry.settingId === 'string' &&
      typeof entry.selector === 'string',
  );
}

async function addPendingPickedSelector(
  entry: PendingPickedSelector,
): Promise<void> {
  const picked = await loadPendingPickedSelectors();
  picked.push(entry);
  await chrome.storage.local.set({ pendingPickedSelectors: picked });
}

// Removes both pending keys (after the popup applied the picks, or when
// a pick session is discarded).
async function clearPendingPickState(): Promise<void> {
  await chrome.storage.local.remove([...PENDING_KEYS]);
}

export {
  addPendingPickedSelector,
  clearPendingPickState,
  loadPendingPick,
  loadPendingPickedSelectors,
  loadStorageData,
  normalizeStoredData,
  removePendingPick,
  savePendingPick,
  saveStorageData,
};
export type {
  PendingPick,
  PendingPickedSelector,
  StoredData,
  StoredSetting,
};
