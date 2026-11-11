import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addPendingPickedSelector,
  clearPendingPickState,
  loadPendingPickedSelectors,
  loadPendingPick,
  loadStorageData,
  savePendingPick,
  saveStorageData,
} from './storage.ts';

// Minimal in-memory mock of the chrome.storage areas used by
// storage.ts.
function makeArea(store: { [key: string]: unknown }) {
  return {
    get: vi.fn(async (keys: string | string[] | null) => {
      if (keys === null) {
        return { ...store };
      }
      const list = Array.isArray(keys) ? keys : [keys];
      const out: { [key: string]: unknown } = {};
      for (const key of list) {
        if (key in store) {
          out[key] = store[key];
        }
      }
      return out;
    }),
    set: vi.fn(async (items: { [key: string]: unknown }) => {
      Object.assign(store, items);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete store[key];
      }
    }),
  };
}

let localStore: { [key: string]: unknown };
let localArea: ReturnType<typeof makeArea>;

const aSetting = {
  id: 'abc',
  name: 'A',
  urlPattern: '*',
  selectors: [],
  format: '{Title}',
};

beforeEach(() => {
  localStore = {};
  localArea = makeArea(localStore);
  // No `sync` area is stubbed on purpose: the release build must never
  // touch chrome.storage.sync (there is no migration), so any access
  // would throw here.
  vi.stubGlobal('chrome', {
    storage: { local: localArea },
  });
});

describe('loadStorageData normalization', () => {
  it('guarantees settings=[] and dict={} on a fresh install', async () => {
    const data = await loadStorageData();
    expect(data.settings).toEqual([]);
    expect(data.lastSelectedSettingIdDict).toEqual({});
    // And the array is usable as-is (the first save pushes into it).
    data.settings.push(aSetting as never);
    expect(data.settings).toHaveLength(1);
  });

  it('returns local data as stored', async () => {
    localStore.settings = [aSetting];
    localStore.lastSelectedSettingIdDict = { 'example.com': 'abc' };

    const data = await loadStorageData();
    expect(data.settings).toEqual([aSetting]);
    expect(data.lastSelectedSettingIdDict).toEqual({
      'example.com': 'abc',
    });
    // Loading must not write anything back.
    expect(localArea.set).not.toHaveBeenCalled();
  });

  it('coerces malformed stored values to the empty shapes', async () => {
    localStore.settings = 'not-an-array';
    localStore.lastSelectedSettingIdDict = { ok: 'abc', bad: 42 };

    const data = await loadStorageData();
    expect(data.settings).toEqual([]);
    expect(data.lastSelectedSettingIdDict).toEqual({ ok: 'abc' });
  });
});

describe('saveStorageData key scoping', () => {
  it('writes only the data keys present, dropping anything else', async () => {
    await saveStorageData({
      settings: [aSetting],
      pendingPick: { settingId: 'abc' },
      somethingElse: 42,
    });
    expect(localArea.set).toHaveBeenCalledTimes(1);
    const payload = localArea.set.mock.calls[0][0];
    expect(Object.keys(payload)).toEqual(['settings']);
    expect(localStore.pendingPick).toBeUndefined();
  });

  it('writing the dict alone does not touch settings', async () => {
    localStore.settings = [aSetting];
    await saveStorageData({
      lastSelectedSettingIdDict: { 'example.com': 'abc' },
    });
    const payload = localArea.set.mock.calls[0][0];
    expect(Object.keys(payload)).toEqual(['lastSelectedSettingIdDict']);
    expect(localStore.settings).toEqual([aSetting]);
  });
});

describe('pending pick helpers', () => {
  it('round-trips pending pick state independently of settings saves', async () => {
    await savePendingPick({ settingId: 'abc' });
    expect(await loadPendingPick()).toEqual({ settingId: 'abc' });

    await addPendingPickedSelector({ settingId: 'abc', selector: '#a' });
    await addPendingPickedSelector({ settingId: 'abc', selector: '#b' });
    expect(await loadPendingPickedSelectors()).toEqual([
      { settingId: 'abc', selector: '#a' },
      { settingId: 'abc', selector: '#b' },
    ]);

    // A normal settings save must not clear the pending state.
    await saveStorageData({ settings: [aSetting] });
    expect(await loadPendingPickedSelectors()).toHaveLength(2);

    await clearPendingPickState();
    expect(await loadPendingPick()).toBeNull();
    expect(await loadPendingPickedSelectors()).toEqual([]);
  });
});
