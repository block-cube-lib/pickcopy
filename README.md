# PickCopy

ワンクリックでサイトの情報をコピーするChrome拡張機能。

設定によりサイト内のどの情報をコピーするのかを選択可能。\
設定はブラウザ内に保存される。エクスポート／インポートも可能。

入力項目

- URL Pattern サイトのURLのパターンを指定する。
- QuerySelector コピーする要素を指定する。複数入力可能。
- Format 最終的なテキストを生成するためのフォーマット。

## 開発

Node.js と npm が必要です。

```sh
npm install     # 依存関係のインストール
npm run build   # dist/ に拡張機能をビルド
npm test        # テスト
npm run typecheck # 型チェック
```

ビルドされた拡張機能を読み込むには、Chrome で `chrome://extensions` を開き、
デベロッパーモードを有効にして「パッケージ化されていない拡張機能を読み込む」
から `dist/` ディレクトリを選択してください。
