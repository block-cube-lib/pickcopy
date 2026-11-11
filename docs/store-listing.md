# Chrome Web Store listing — PickCopy (draft)

## Name
PickCopy

## Summary (max 132 characters)

EN: Pick elements on any page, save the rule per site, and copy in your own format with one click.
(97 chars)

JA: ページの要素をピックして、サイト別ルールとして保存。次からはワンクリックで自分の書式でコピーできます。
(53 chars)

## Category
Developer Tools (alternative: Productivity / Workflow)

## Description (EN)

Copy the same things from the same sites, over and over? PickCopy remembers
how.

1. Open a page and click "Pick element from page" — click the part you want
   (a title, a price, an issue number) and PickCopy writes the CSS selector
   for you. No DevTools spelunking.
2. Arrange the picked pieces in your own format, e.g.
   `{0} - {1} ({URL})`, and save it as a rule for that site's URL pattern.
3. Next time, just open the page and click Copy. The rule for the site is
   selected automatically and the formatted text lands on your clipboard.

Features
- Per-site rules: URL pattern × multiple selectors × free-form format
  template with {0}, {1}, …, {Title} and {URL} placeholders
- Attribute extraction: append `@href`, `@datetime`, etc. to a selector
- Element picker that generates a unique selector from a click
- Settings export/import as JSON — share rules with your team or move them
  between browsers
- Everything stays on your device: no account, no server, no tracking

Three presets (page title + URL, Markdown link, title only) are included so
you can try it immediately.

## Description (JA)

同じサイトから、いつも同じものをコピーしていませんか。PickCopy は
その手順をルールとして覚えます。

1. ページを開いて「Pick element from page」を押し、欲しい部分
   （タイトル、価格、チケット番号など）をクリックするだけ。
   CSSセレクタは PickCopy が自動で書きます。検証ツールと格闘不要です。
2. 拾った要素を `{0} - {1} ({URL})` のような自分の書式に並べて、
   そのサイトの URLパターンに対するルールとして保存します。
3. 次回からは、ページを開いて Copy を押すだけ。サイトに合った
   ルールが自動で選ばれ、整形済みテキストがクリップボードに入ります。

機能
- サイト別ルール：URLパターン × 複数セレクタ × 自由な書式テンプレート
  （{0} {1} … {Title} {URL} プレースホルダ対応）
- 属性の抽出：セレクタ末尾に `@href` `@datetime` などを付けられます
- クリックで一意なセレクタを生成する要素ピッカー
- 設定の書き出し・取り込み（JSON）— チームへの配布やブラウザ間の引っ越しに
- すべてデバイス内で完結：アカウント不要、サーバーなし、トラッキングなし

すぐに試せるプリセット（タイトル+URL、Markdownリンク、タイトルのみ）
を3つ同梱しています。

## Privacy practices form (answers)

- Single purpose: Copy user-selected page content to the clipboard in a
  user-defined format, using per-site rules the user creates.
- Data usage: PickCopy does not collect or transmit any user data. All
  settings are stored locally (chrome.storage.local). For the form:
  - "Do you collect user data?" → No data is collected, sold, or
    transferred. Page content is read locally, only at the user's click,
    solely to place it on the user's own clipboard.
- Permission justifications:
  - storage: Persist the user's copy rules and last-selected rule per site
    in local storage.
  - activeTab: Identify the current tab's URL to select the matching rule
    and to communicate with the page when the user clicks Copy.
  - clipboardWrite: Write the formatted result to the clipboard.
  - Host permission (<all_urls> via content_scripts): Rules are defined by
    the user for arbitrary sites, so the content script must run on any
    page the user copies from. It reads only the elements matching the
    user's own selectors, only when the user clicks Copy or uses the
    element picker.
- Remote code: None. All JavaScript is bundled in the package.
- Privacy policy URL: https://github.com/block-cube-lib/pickcopy/blob/main/docs/privacy-policy.md
  (owner decision 2026-11-11: host it as a page in the GitHub repository)

## Assets status

- Icon 128px: ready (public/icons/icon128.png, also 16/32/48 in the package)
- Screenshots (1280×800): in docs/store-assets/
- Promotional tile 440×280: optional, not prepared
