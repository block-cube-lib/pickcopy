// Pure logic for generating a CSS selector that identifies one element.
//
// Used by the element picker in the content script. Scope notes:
// - Only the main document is supported: elements inside iframes or
//   shadow DOM are out of scope.
// - The returned selector is verified with
//   `document.querySelectorAll(selector).length === 1` whenever possible;
//   if no unique selector can be built, the full ancestor path is
//   returned as a best effort.

// Escape a value for use as a CSS identifier (id or class name).
function escapeIdent(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (/[a-zA-Z0-9_-]/.test(ch)) {
      // A leading digit is not valid in an identifier; escape it as a
      // code point (e.g. "1" -> "\31 ").
      if (i === 0 && /[0-9]/.test(ch)) {
        result += `\\3${ch} `;
      } else {
        result += ch;
      }
    } else {
      result += `\\${ch}`;
    }
  }
  return result;
}

function classNamesOf(element: Element): string[] {
  const classAttr = element.getAttribute('class');
  if (!classAttr) {
    return [];
  }
  return classAttr.split(/\s+/).filter((name) => name !== '');
}

// One path segment for an element: tag name, its classes, and
// :nth-of-type() when siblings share the same tag name.
function segmentOf(element: Element): string {
  const tag = element.tagName.toLowerCase();
  let segment = tag;
  const classes = classNamesOf(element);
  if (classes.length > 0) {
    segment += `.${classes.map(escapeIdent).join('.')}`;
  }

  const parent = element.parentElement;
  if (parent) {
    const sameTagSiblings = Array.from(parent.children).filter(
      (child) => child.tagName === element.tagName,
    );
    if (sameTagSiblings.length > 1) {
      segment += `:nth-of-type(${sameTagSiblings.indexOf(element) + 1})`;
    }
  }
  return segment;
}

function isUnique(selector: string, element: Element, doc: Document): boolean {
  try {
    const matches = doc.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === element;
  } catch {
    return false;
  }
}

function generateSelector(element: Element, doc: Document = document): string {
  // Prefer the id when it identifies the element on its own.
  if (element.id) {
    const idSelector = `#${escapeIdent(element.id)}`;
    if (isUnique(idSelector, element, doc)) {
      return idSelector;
    }
  }

  // Build the full ancestor path, then return the shortest trailing
  // portion of it that is still unique.
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current.tagName.toLowerCase() !== 'html') {
    segments.unshift(segmentOf(current));
    current = current.parentElement;
  }
  // Include <html> itself when the target is <html> or <body>.
  if (current && segments.length === 0) {
    segments.unshift(segmentOf(current));
  }

  for (let length = 1; length <= segments.length; length++) {
    const candidate = segments.slice(segments.length - length).join(' > ');
    if (isUnique(candidate, element, doc)) {
      return candidate;
    }
  }

  // No unique selector found: fall back to the full path.
  return segments.join(' > ');
}

export { generateSelector };
