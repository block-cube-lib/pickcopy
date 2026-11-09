// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { generateSelector } from './selector.ts';

describe('generateSelector', () => {
  it('returns #id when the id is unique', () => {
    document.body.innerHTML = '<div><p id="target">hello</p><p>other</p></div>';
    const element = document.getElementById('target')!;
    expect(generateSelector(element)).toBe('#target');
  });

  it('does not use a duplicated id as-is', () => {
    document.body.innerHTML =
      '<div><span id="dup">a</span></div><div><span id="dup">b</span></div>';
    const element = document.querySelectorAll('#dup')[1];
    const selector = generateSelector(element);
    expect(selector).not.toBe('#dup');
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    expect(document.querySelector(selector)).toBe(element);
  });

  it('builds a unique path from tag and classes', () => {
    document.body.innerHTML =
      '<ul class="list"><li class="item">1</li><li class="item active">2</li></ul>';
    const element = document.querySelector('.active')!;
    const selector = generateSelector(element);
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    expect(document.querySelector(selector)).toBe(element);
  });

  it('uses :nth-of-type() to tell identical siblings apart', () => {
    document.body.innerHTML =
      '<div><p>one</p><p>two</p><p>three</p></div>';
    const element = document.querySelectorAll('p')[1];
    const selector = generateSelector(element);
    expect(selector).toContain(':nth-of-type(2)');
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    expect(document.querySelector(selector)).toBe(element);
  });

  it('escapes ids and classes that need escaping', () => {
    // Leading digit in the id and a ':' in the class both require
    // escaping (via CSS.escape, or the built-in fallback when the
    // environment lacks CSS.escape, as jsdom does).
    document.body.innerHTML =
      '<div><p id="1st">x</p><span class="a:b">y</span><span>z</span></div>';
    const byId = document.getElementById('1st')!;
    const idSelector = generateSelector(byId);
    expect(document.querySelectorAll(idSelector)).toHaveLength(1);
    expect(document.querySelector(idSelector)).toBe(byId);

    const byClass = document.querySelector('.a\\:b')!;
    const classSelector = generateSelector(byClass);
    expect(document.querySelectorAll(classSelector)).toHaveLength(1);
    expect(document.querySelector(classSelector)).toBe(byClass);
  });

  it('returns a full path for deeply nested elements', () => {
    document.body.innerHTML =
      '<section><div><span><a href="#">x</a></span></div></section>' +
      '<section><div><span><a href="#">y</a></span></div></section>';
    const element = document.querySelectorAll('a')[1];
    const selector = generateSelector(element);
    expect(selector).toContain(' > ');
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    expect(document.querySelector(selector)).toBe(element);
  });
});
