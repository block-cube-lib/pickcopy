import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { Setting } from './setting.ts';

Deno.test('Setting.createNew generates an ID', () => {
  const setting = Setting.createNew();
  assert(setting.id);
  assertEquals(setting.name, '');
  assertEquals(setting.urlPattern, '');
  assertEquals(setting.selectors, []);
  assertEquals(setting.format, '');
});

Deno.test('Setting.isUrlMatched matches exact patterns', () => {
  const setting = new Setting('1', 'Test', 'https://example.com/page', [], '');
  assert(setting.isUrlMatched('https://example.com/page'));
  assertFalse(setting.isUrlMatched('https://example.com/other'));
});

Deno.test('Setting.isUrlMatched matches wildcard patterns', () => {
  const setting = new Setting('1', 'Test', 'https://example.com/*', [], '');
  assert(setting.isUrlMatched('https://example.com/page'));
  assert(setting.isUrlMatched('https://example.com/some/long/path'));
  assertFalse(setting.isUrlMatched('https://otherdomain.com/'));
});

Deno.test('Setting.isUrlMatched matches subdomain wildcard patterns', () => {
  const setting = new Setting('1', 'Test', 'https://*.example.com', [], '');
  assert(setting.isUrlMatched('https://sub.example.com'));
  assert(setting.isUrlMatched('https://another.sub.example.com'));
  assertFalse(setting.isUrlMatched('https://example.com')); // Since it matches "*.example.com" literal wildcard
});

Deno.test('Setting.isUrlMatched returns false when urlPattern is empty', () => {
  const setting = new Setting('1', 'Test', '', [], '');
  assertFalse(setting.isUrlMatched('https://example.com'));
});
