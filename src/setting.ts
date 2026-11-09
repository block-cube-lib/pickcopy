class Setting {
  id: string;
  name: string;
  urlPattern: string;
  selectors: string[];
  format: string;

  constructor(
    id: string,
    name: string,
    urlPattern: string,
    selectors: string[],
    format: string,
  ) {
    this.id = id;
    this.name = name;
    this.urlPattern = urlPattern;
    this.selectors = selectors;
    this.format = format;
  }

  static createNew() {
    const id = crypto.randomUUID();
    return new Setting(id, '', '', [], '');
  }

  isUrlMatched(url: string) {
    if (!this.urlPattern) {
      return false;
    }

    // Escape special characters for regular expression.
    const escapeRegExp = (str: string) => {
      // $& means the entire matched substring.
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Escape other special characters before replacing '*' with '.*'.
    const regexPattern = this.urlPattern.split('*').map(escapeRegExp).join(
      '.*',
    );
    // Anchor the pattern so it must match the whole URL, not a substring.
    return new RegExp(`^${regexPattern}$`).test(url);
  }
}

// Shared parsing for the multi-line selectors textarea: one selector
// per line, blank (or whitespace-only) lines are dropped. The popup's
// live input handler, the popup's save path and the settings page all
// use this, so the selectors the preview works with while editing are
// exactly the ones that end up saved (and {n} placeholders in the
// format never shift between preview and a saved setting).
function parseSelectorsInput(text: string): string[] {
  return text.split('\n').filter((line) => line.trim() !== '');
}

export { parseSelectorsInput, Setting };
