# PickCopy Privacy Policy

_Last updated: 2026-11-11_

PickCopy is a Chrome extension that copies content from web pages to the
clipboard according to rules (URL pattern, element selectors, and a format
template) that you define yourself.

## Data collection

PickCopy does **not** collect, transmit, sell, or share any personal or
usage data. The extension has no server, no analytics, and no third-party
SDKs. It makes no network requests.

## Data stored on your device

The settings you create (name, URL pattern, CSS selectors, format template,
and which setting was last selected for a site) are stored only in your
browser's local extension storage (`chrome.storage.local`) on your device.
This data never leaves your device, except when you explicitly use the
built-in export feature, which downloads a JSON file to your own computer.

## Page access

To perform a copy, PickCopy reads the parts of the current page that your
own selectors match, formats them with your template, and writes the result
to your clipboard. This happens entirely inside your browser, only when you
click the Copy button or pick an element. Page content is never stored or
sent anywhere.

## Permissions

- `storage` — to save your settings locally.
- `activeTab` and host access (`<all_urls>`) — your rules can target any
  site you choose, so the content script must be able to run on the page
  you are copying from. It only acts on your click.
- `clipboardWrite` — to place the copied text on your clipboard.

## Contact

Questions about this policy: please use the support contact listed on the
Chrome Web Store page, or open an issue at
https://github.com/block-cube-lib/scriptable_copy

---

# PickCopy プライバシーポリシー

_最終更新: 2026-11-11_

PickCopy は、あなた自身が定義したルール（URLパターン、要素セレクタ、
書式テンプレート）に従って、Webページの内容をクリップボードへコピーする
Chrome拡張機能です。

## データの収集について

PickCopy は、個人データ・利用データを一切収集・送信・販売・共有しません。
サーバー、アクセス解析、第三者SDK は存在せず、ネットワークリクエストも
行いません。

## デバイス内に保存されるデータ

作成した設定（名前、URLパターン、CSSセレクタ、書式テンプレート、
サイトごとの最終選択）は、お使いのブラウザのローカルストレージ
（`chrome.storage.local`）にのみ保存されます。このデータがデバイスの
外に出ることはありません。例外は、組み込みの書き出し機能をあなた自身が
使って JSON ファイルを自分のコンピュータにダウンロードする場合だけです。

## ページへのアクセスについて

コピーを実行する際、PickCopy はあなたのセレクタに一致する現在のページの
部分を読み取り、テンプレートで整形してクリップボードに書き込みます。
これはすべてブラウザ内で、Copyボタンのクリックまたは要素のピック操作の
ときにのみ行われます。ページの内容が保存・送信されることはありません。

## 権限について

- `storage` — 設定をローカルに保存するため
- `activeTab` とホストアクセス（`<all_urls>`）— ルールの対象はあなたが
  選ぶ任意のサイトになるため、コピー元のページでコンテンツスクリプトが
  動作する必要があります。動作するのはクリックしたときだけです
- `clipboardWrite` — コピーしたテキストをクリップボードに置くため

## お問い合わせ

本ポリシーに関する質問は、Chromeウェブストアの掲載ページに記載の
サポート連絡先、または https://github.com/block-cube-lib/scriptable_copy
の Issue へお願いします。
