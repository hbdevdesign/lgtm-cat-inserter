# LGTM Cat Inserter

GitHubのPR・Issueコメント欄に、猫のLGTM画像をワンクリックでMarkdown挿入できるChrome拡張機能。

画像は [lgtmeow.com](https://lgtmeow.com) のAPIからランダムに取得されます。

## 機能

- コメント欄のMarkdownツールバーに猫アイコンボタンを追加
- クリックすると5枚のランダムな猫LGTM画像を表示
- 画像を選ぶと `![LGTM](画像URL)` がコメント欄に挿入される
- PRのレビューダイアログ・インラインコメントにも対応
- 「Refresh Cats」ボタンで別の画像に入れ替え可能

## インストール方法

1. このリポジトリをクローンまたはダウンロード
2. Chromeで `chrome://extensions/` を開く
3. 右上の「デベロッパーモード」を有効化
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、このディレクトリを選択
5. GitHubのPR・Issueページを開き、コメント欄ツールバーに猫アイコンが表示されることを確認

## 仕組み

GitHubのCSP（Content Security Policy）制限を回避するため、3層構造で動作します。

| コンポーネント | ファイル | 役割 |
|:--|:--|:--|
| Background Script | `background.js` | `lgtmeow.com` APIへの通信を代行（Service Worker） |
| Content Script | `content.js` | GitHub上のDOM操作（ボタン注入・ダイアログ表示・Markdown挿入） |
| スタイル | `styles.css` | ボタン・ダイアログ・グリッドのスタイル定義 |

## 動作確認方法

コード変更後は以下の手順で確認してください。

1. `chrome://extensions/` で拡張機能の「更新」ボタンをクリック（またはリロードアイコン）
2. GitHubのPR・Issueページを再読み込み
3. コメント欄ツールバーに猫アイコンが表示されることを確認
4. 猫アイコンをクリックし、画像選択ダイアログが表示されることを確認
5. 画像をクリックし、Markdownがコメント欄に挿入されることを確認
6. Commentボタンが活性化（クリック可能）になっていることを確認

## ファイル構成

```
lgtm-cat-extension/
├── manifest.json      # 拡張機能の設定（権限・Service Worker定義）
├── background.js      # API通信代行ロジック
├── content.js         # GitHub上のUI制御・画像挿入
├── styles.css         # ボタン・ダイアログ・グリッドのスタイル
├── icons/
│   └── cat.png        # 猫アイコン画像
├── requirements.md    # 要件定義書
└── README.md          # 本ファイル
```

## 既知の制約

- **Chrome専用**: Manifest V3ベースのためChrome（またはChromium系ブラウザ）が必要
- **`document.execCommand`**: 非推奨APIだが、ReactのGitHub UIで内部状態を更新しCommentボタンを活性化するために必要。`textarea.value`の直接代入では動作しない
- **GitHub DOM依存**: GitHubのUI変更により、ボタン注入やtextarea検出が動作しなくなる可能性がある
- **個人利用**: `lgtmeow.com` の公式APIを利用しており、個人利用の範囲内で運用

