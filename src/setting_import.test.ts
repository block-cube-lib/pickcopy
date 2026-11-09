import { describe, expect, it } from 'vitest';
import {
  normalizeImportedSetting,
  parseImportedSettings,
} from './setting_import.ts';

describe('normalizeImportedSetting', () => {
  it('accepts a well-formed entry', () => {
    const setting = normalizeImportedSetting({
      id: 'x1',
      name: 'Name',
      urlPattern: 'https://example.com/*',
      selectors: ['h1', 'a@href'],
      format: '{0} {1}',
    });
    expect(setting).not.toBeNull();
    expect(setting!.id).toBe('x1');
    expect(setting!.selectors).toEqual(['h1', 'a@href']);
  });

  it('fills missing fields with empty values', () => {
    const setting = normalizeImportedSetting({ id: 'x2' });
    expect(setting).not.toBeNull();
    expect(setting!.name).toBe('');
    expect(setting!.urlPattern).toBe('');
    expect(setting!.selectors).toEqual([]);
    expect(setting!.format).toBe('');
  });

  it('drops entries with a non-string or empty id', () => {
    expect(normalizeImportedSetting({ id: 42 })).toBeNull();
    expect(normalizeImportedSetting({ id: '' })).toBeNull();
    expect(normalizeImportedSetting({ name: 'no id' })).toBeNull();
    expect(normalizeImportedSetting(null)).toBeNull();
    expect(normalizeImportedSetting('a string')).toBeNull();
  });

  it('drops entries whose fields have wrong types', () => {
    expect(normalizeImportedSetting({ id: 'x', name: 1 })).toBeNull();
    expect(
      normalizeImportedSetting({ id: 'x', selectors: 'h1' }),
    ).toBeNull();
  });

  it('keeps only string selectors from a mixed list', () => {
    const setting = normalizeImportedSetting({
      id: 'x',
      selectors: ['h1', 42, null, 'p'],
    });
    expect(setting!.selectors).toEqual(['h1', 'p']);
  });

  it('re-assigns a new UUID when the id collides with a preset', () => {
    for (
      const presetId of [
        'defaultSetting',
        'titleAndURLSetting',
        'markdownSetting',
      ]
    ) {
      const setting = normalizeImportedSetting({ id: presetId });
      expect(setting).not.toBeNull();
      expect(setting!.id).not.toBe(presetId);
      expect(setting!.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });
});

describe('parseImportedSettings', () => {
  it('parses an array and drops invalid entries', () => {
    const settings = parseImportedSettings([
      { id: 'a', name: 'A' },
      { id: 1 },
      null,
    ]);
    expect(settings.map((s) => s.id)).toEqual(['a']);
  });

  it('parses the current export format ({ settings: [...] })', () => {
    const settings = parseImportedSettings({
      settings: [{ id: 'a' }],
      lastSelectedSettingIdDict: { 'example.com': 'a' },
    });
    expect(settings.map((s) => s.id)).toEqual(['a']);
  });

  it('parses the legacy { [id]: setting } format via pattern fallback', () => {
    const settings = parseImportedSettings({
      'my-id': {
        name: 'Legacy',
        pattern: 'https://example.com/*',
        selectors: ['h1'],
        format: '{0}',
      },
    });
    expect(settings).toHaveLength(1);
    expect(settings[0].urlPattern).toBe('https://example.com/*');
  });

  it('does not register reserved storage keys as legacy settings', () => {
    const settings = parseImportedSettings({
      pendingPick: { settingId: 'x' },
      pendingPickedSelectors: [{ settingId: 'x', selector: '#a' }],
      migratedFromSync: true,
      lastSelectedSettingIdDict: { 'example.com': 'x' },
      real: { name: 'Real', selectors: [], format: '' },
    });
    expect(settings.map((s) => s.id)).toEqual(['real']);
  });

  it('returns [] for non-object input', () => {
    expect(parseImportedSettings(42)).toEqual([]);
    expect(parseImportedSettings(null)).toEqual([]);
    expect(parseImportedSettings('json')).toEqual([]);
  });
});
