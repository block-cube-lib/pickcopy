import { describe, expect, it } from 'vitest';
import { parseSelectorsInput, Setting } from './setting.ts';

describe('parseSelectorsInput', () => {
  it('splits one selector per line', () => {
    expect(parseSelectorsInput('h1\na@href')).toEqual(['h1', 'a@href']);
  });

  it('drops blank and whitespace-only lines', () => {
    expect(parseSelectorsInput('h1\n\n   \n\t\np\n')).toEqual(['h1', 'p']);
  });

  it('returns [] for empty input', () => {
    expect(parseSelectorsInput('')).toEqual([]);
  });
});

describe('Setting.createNew', () => {
  it('generates an ID and empty fields', () => {
    const setting = Setting.createNew();
    expect(setting.id).toBeTruthy();
    expect(setting.name).toBe('');
    expect(setting.urlPattern).toBe('');
    expect(setting.selectors).toEqual([]);
    expect(setting.format).toBe('');
  });
});

describe('Setting.isUrlMatched', () => {
  it('matches exact patterns', () => {
    const setting = new Setting('1', 'Test', 'https://example.com/page', [], '');
    expect(setting.isUrlMatched('https://example.com/page')).toBe(true);
    expect(setting.isUrlMatched('https://example.com/other')).toBe(false);
  });

  it('does not match as a substring (anchored)', () => {
    const setting = new Setting('1', 'Test', 'https://example.com/page', [], '');
    expect(setting.isUrlMatched('https://example.com/page2')).toBe(false);
    expect(setting.isUrlMatched('https://example.com/page/extra')).toBe(false);
    expect(
      setting.isUrlMatched('https://evil.example/?https://example.com/page'),
    ).toBe(false);
  });

  it('matches wildcard patterns', () => {
    const setting = new Setting('1', 'Test', 'https://example.com/*', [], '');
    expect(setting.isUrlMatched('https://example.com/page')).toBe(true);
    expect(setting.isUrlMatched('https://example.com/some/long/path')).toBe(true);
    expect(setting.isUrlMatched('https://otherdomain.com/')).toBe(false);
  });

  it("matches '*' against everything", () => {
    const setting = new Setting('1', 'Test', '*', [], '');
    expect(setting.isUrlMatched('https://example.com/anything')).toBe(true);
    expect(setting.isUrlMatched('chrome://extensions')).toBe(true);
  });

  it('matches subdomain wildcard patterns', () => {
    const setting = new Setting('1', 'Test', 'https://*.example.com', [], '');
    expect(setting.isUrlMatched('https://sub.example.com')).toBe(true);
    expect(setting.isUrlMatched('https://another.sub.example.com')).toBe(true);
    // Since it matches "*.example.com" literal wildcard
    expect(setting.isUrlMatched('https://example.com')).toBe(false);
    expect(setting.isUrlMatched('https://sub.example.com.evil.com')).toBe(false);
  });

  it('returns false when urlPattern is empty', () => {
    const setting = new Setting('1', 'Test', '', [], '');
    expect(setting.isUrlMatched('https://example.com')).toBe(false);
  });
});
