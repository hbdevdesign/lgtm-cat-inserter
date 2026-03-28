# Chrome拡張機能：LGTM Cat Inserter 要件定義書

## 1. プロジェクト概要

GitHubのプルリクエスト等のコメント欄において、`lgtmeow.com` が提供する猫のLGTM画像をワンクリックで呼び出し、コメント欄にMarkdown形式で挿入できるChrome拡張機能。

## 2. システム構成・アーキテクチャ

GitHubの強力なセキュリティ制限（CSP）を回避するため、以下の3層構造で動作する。

| コンポーネント    | 役割                                                            |
| :---------------- | :-------------------------------------------------------------- |
| Manifest V3       | 拡張機能の権限管理と各スクリプトの紐付け。                      |
| Content Script    | GitHubのDOM操作（ボタン注入、ダイアログ表示、文字挿入）。       |
| Background Script | API通信の代行。GitHubのCSPを回避し外部APIからデータを取得する。 |

## 3. 機能要件

### ① UI注入（Button Injection）

- **場所**: GitHubのMarkdownツールバー（`markdown-toolbar`要素）の末尾（右端）。ツールバーが非表示の場合（Primer MarkdownEditor）は、可視ヘッダー要素（`toolbar.nextElementSibling.firstElementChild`）にフォールバック配置する。
- **表示**: `icons/cat.png` の猫アイコン画像（16x16）のみのボタン。GitHubツールバーのアイコンスタイルに合わせた透明背景のアイコンボタン。
- **ツールチップ**: "LGTM Cat"
- **動作**: クリック時に画像選択ダイアログをトグル表示。高速ダブルクリックによる複数ダイアログ生成を`dialogOpen`フラグで防止。
- **textarea検出**: 以下の3段階フォールバックでtextareaを特定する: (1) ツールバーの`for`属性から`document.getElementById`、(2) `.js-previewable-comment-form`内のtextarea、(3) 親`form`内のtextarea。textareaが見つからない場合はボタン注入をスキップし、次回のMutationObserver発火時に再試行する。
- **DOM監視**: `MutationObserver`でページの動的変更を監視し、新たに表示されたコメントフォームにも自動でボタンを注入。`data-lgtm-injected`属性で重複注入を防止。

### ② 画像選択ダイアログ（UI/UX）

- **表示位置**: 画面中央に固定表示（`position: fixed`、`z-index: 99999`）。
- **サイズ**: 幅 最大960px（`min(960px, calc(100vw - 32px))`）、最大高さ `calc(100vh - 32px)`（スクロール対応）。
- **ヘッダー**: 猫アイコン（`icons/cat.png`）と「Choose a cat」のタイトルを表示。
- **レイアウト**: Flexboxによる横並び折り返しグリッド表示（`flex: 1 1 140px`、最小幅120px、高さ160px）。
- **コンテンツ**:
  - ランダムに取得された5枚の猫画像。
  - 各画像はホバー時に青枠ハイライト・拡大エフェクト。
  - **🔄 Refresh Cats** ボタン（新しい画像への入れ替え）。
- **閉じる動作**: 画像選択時、ダイアログ外クリック時、またはボタン再クリック時に閉じる。いずれの閉じ方でも`removeDialog`ヘルパーを経由し、外クリック用イベントリスナーを確実に解除する。
- **フォーカス管理**: ダイアログを開閉する際、および画像選択後にフォーカスを元のtextareaに戻す。これによりキーボード入力コンテキストを維持し、GitHubレビューダイアログ内でのフォーカス喪失を防ぐ。
- **配置先**: ダイアログは`textarea.closest('[role="dialog"]')`（GitHubレビューダイアログ）内に配置する。レビューダイアログが存在しない場合は`document.body`に配置する。これによりGitHub側の外クリック判定によるレビューダイアログの意図しない閉じを防ぐ。

### ③ 画像取得機能

- **ソース**: `https://lgtmeow.com/api/lgtm-images`
- **取得数**: 1回につき5枚。
- **通信方式**: Content Scriptから`chrome.runtime.sendMessage`でBackground Script（Service Worker）に依頼し、Background Scriptが`fetch`でAPI通信を代行。非同期レスポンス対応（`return true`パターン）。
- **安全性**: Background Scriptを経由することで、クロスドメイン制約およびCSP制限をクリア。

### ④ コメント挿入機能

- **形式**: `![LGTM](画像URL)`
- **挿入方式**: `document.execCommand("insertText")`を使用し、ブラウザネイティブのテキスト挿入を経由。これによりReactの内部状態が確実に更新され、Commentボタンが活性化する。
- **最適化**: カーソル直前が空または改行済みの場合は接頭辞なし、それ以外は改行1つのみ付与し、不要な空行を排除。

## 4. 非機能要件・制約

- **セキュリティ**: ダイアログ内の画像に`referrerpolicy="no-referrer"`を付与し、画像表示時のブロックを防止。
- **アイコンリソース**: `icons/cat.png`を`web_accessible_resources`に登録し、GitHub上のContent Scriptからアクセス可能にする。
- **法的配慮**: `lgtmeow.com` の公式APIを利用し、個人利用の範囲内で運用。
- **タイムアウト**: API通信（Background Scriptの`fetch`）およびContent Scriptの`sendMessage`にそれぞれ10秒のタイムアウトを設定。タイムアウト時はエラーUIを表示する。
- **エラーハンドリング**: `chrome.runtime.lastError`を`sendMessage`コールバック内で先にチェックし、Service Worker停止時のエラーを適切に処理する。個別の画像読み込み失敗時は該当画像を非表示にする（`img.onerror`）。
- **パフォーマンス**: 画像読み込み中は「Searching for cats... 🐾」とステータスを表示。エラー時は赤文字でエラーメッセージを表示。
- **権限**: `activeTab`権限と`https://github.com/*`、`https://lgtmeow.com/*`、`https://*.lgtmeow.com/*`のhost_permissionsを使用。

## 5. フォルダ構成

```plaintext
lgtm-cat-extension/
├── manifest.json      # 設定ファイル（権限・Service Worker定義）
├── background.js      # API通信代行ロジック（Service Worker）
├── content.js         # GitHub上のUI制御・画像挿入
├── styles.css         # ボタン・ダイアログ・グリッドの意匠
├── icons/
│   └── cat.png        # 猫アイコン画像（拡張機能アイコン・ツールバーボタン・ダイアログヘッダーで使用）
├── requirements.md    # 本要件定義書
└── README.md          # 導入方法・使い方・仕組みの説明
```

## 6. 技術スタック

- JavaScript (ES6+, Chrome Extension API Manifest V3)
- CSS (Flexbox Layout)
- Web Fetch API
- MutationObserver API
