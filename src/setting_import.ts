// Validation/normalization for settings imported from JSON.
//
// Imported files are untrusted input: entries may be missing fields,
// have wrong types, or reuse IDs that collide with the built-in preset
// settings. Everything imported goes through normalizeImportedSetting
// so the rest of the app can rely on the Setting shape.

import { Setting } from './setting.ts';

// IDs of the built-in preset settings (see app.ts). An imported
// setting must never take one of these IDs, or it would be shadowed by
// / mistaken for a preset, so collisions are re-assigned a fresh UUID.
const PRESET_SETTING_IDS: ReadonlySet<string> = new Set([
  'defaultSetting',
  'titleAndURLSetting',
  'markdownSetting',
]);

// Storage keys that may appear in an exported/backup JSON object but
// are not settings. The legacy { [id]: setting } fallback must not
// register these as settings.
const RESERVED_IMPORT_KEYS: ReadonlySet<string> = new Set([
  'settings',
  'lastSelectedSettingIdDict',
  'pendingPick',
  'pendingPickedSelectors',
  'migratedFromSync',
]);

const isRecord = (value: unknown): value is { [key: string]: unknown } =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A string field: missing (undefined) falls back to '', a present
// non-string value makes the whole entry invalid (null).
function stringField(value: unknown): string | null {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : null;
}

// Validate one imported entry. Returns null for entries that cannot be
// trusted (not an object, non-string id, or fields with wrong types).
function normalizeImportedSetting(entry: unknown): Setting | null {
  if (!isRecord(entry)) {
    return null;
  }
  if (typeof entry.id !== 'string' || entry.id === '') {
    return null;
  }
  const name = stringField(entry.name);
  const urlPattern = stringField(entry.urlPattern);
  const format = stringField(entry.format);
  if (name === null || urlPattern === null || format === null) {
    return null;
  }

  let selectors: string[] = [];
  if (entry.selectors !== undefined) {
    if (!Array.isArray(entry.selectors)) {
      return null;
    }
    // Keep only string entries in the selectors list.
    selectors = entry.selectors.filter(
      (s): s is string => typeof s === 'string',
    );
  }

  const id = PRESET_SETTING_IDS.has(entry.id)
    ? crypto.randomUUID()
    : entry.id;
  return new Setting(id, name, urlPattern, selectors, format);
}

// Parse the three accepted top-level shapes:
// - an array of settings
// - an object with a `settings` array (current export format)
// - the legacy { [id]: { name, pattern/urlPattern, selectors, format } }
//   object (reserved storage keys are skipped)
function parseImportedSettings(importedData: unknown): Setting[] {
  const normalizeAll = (entries: unknown[]): Setting[] =>
    entries
      .map((entry) => normalizeImportedSetting(entry))
      .filter((s): s is Setting => s !== null);

  if (Array.isArray(importedData)) {
    return normalizeAll(importedData);
  }
  if (!isRecord(importedData)) {
    return [];
  }
  if (Array.isArray(importedData.settings)) {
    return normalizeAll(importedData.settings);
  }

  const legacyEntries: unknown[] = [];
  for (const [id, value] of Object.entries(importedData)) {
    if (RESERVED_IMPORT_KEYS.has(id) || !isRecord(value)) {
      continue;
    }
    legacyEntries.push({
      id,
      name: value.name,
      urlPattern: value.urlPattern ?? value.pattern,
      selectors: value.selectors,
      format: value.format,
    });
  }
  return normalizeAll(legacyEntries);
}

export {
  normalizeImportedSetting,
  parseImportedSettings,
  PRESET_SETTING_IDS,
  RESERVED_IMPORT_KEYS,
};
