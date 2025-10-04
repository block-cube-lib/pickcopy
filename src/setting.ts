class Setting {
  id: string;
  name: string;
  urlPattern: string;
  selectors: string[];
  format: string;

  constructor(id: string, name: string, urlPattern: string, selectors: string[], format: string) {
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

    // 正規表現の特殊文字をエスケープする
    const escapeRegExp = (str: string) => {
      // $&はマッチした部分文字列全体を意味します
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // `*` を `.*` に置換する前に、他の特殊文字をエスケープする
    const regexPattern = this.urlPattern.split('*').map(escapeRegExp).join('.*');
    return new RegExp(regexPattern).test(url);
  }
}

export { Setting };
