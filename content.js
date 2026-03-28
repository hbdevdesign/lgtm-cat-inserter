// 1. APIからの画像取得を background.js に依頼する
const FETCH_TIMEOUT_MS = 10000;

async function fetchLGTMImages() {
  return Promise.race([
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "fetchLGTMImages" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("LGTM sendMessage error:", chrome.runtime.lastError.message);
          resolve([]);
          return;
        }
        if (response && response.success) {
          resolve(Array.isArray(response.data) ? response.data.slice(0, 5) : []);
        } else {
          console.error(
            "LGTM Fetch Error (from background):",
            response ? response.error : "Unknown error",
          );
          resolve([]);
        }
      });
    }),
    new Promise((resolve) => setTimeout(() => resolve([]), FETCH_TIMEOUT_MS)),
  ]);
}

// 2. Markdownを挿入（先頭の余分な空行・改行を除去）
function insertMarkdown(textarea, imageUrl) {
  const markdown = `![LGTM](${imageUrl})`;
  const before = textarea.value.substring(0, textarea.selectionStart);

  // カーソル直前が空 or 改行済みなら接頭なし、そうでなければ改行1つのみ付与
  const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";

  // execCommand はブラウザネイティブのテキスト挿入を経由するため
  // React の内部状態が確実に更新され、Comment ボタンが活性化する
  textarea.focus();
  textarea.setSelectionRange(textarea.selectionStart, textarea.selectionEnd);
  document.execCommand("insertText", false, prefix + markdown);
}

// 3. ダイアログヘッダーHTML
// NOTE: innerHTML に設定される値は全て拡張機能内の静的コンテンツ（chrome.runtime.getURL）であり、
// ユーザー入力や外部APIデータは含まれないため XSS リスクはない
function dialogHeaderHTML() {
  return `<div class="lgtm-dialog-header">
    <img src="${chrome.runtime.getURL('icons/cat.png')}" width="16" height="16" aria-hidden="true" style="object-fit:contain;flex-shrink:0;">
    <span class="lgtm-dialog-title">Choose a cat</span>
  </div>`;
}

// 4. ダイアログ内の画像描画
async function renderImages(container, textarea) {
  container.innerHTML = `
    ${dialogHeaderHTML()}
    <div class="lgtm-status">Searching for cats... 🐾</div>
  `;

  const images = await fetchLGTMImages();

  if (images.length === 0) {
    container.innerHTML = `
      ${dialogHeaderHTML()}
      <div class="lgtm-status lgtm-status--error">Failed to load cats. Check console for details.</div>
    `;
    return;
  }

  container.innerHTML = dialogHeaderHTML();

  const grid = document.createElement("div");
  grid.className = "lgtm-grid";

  images.forEach((imgData) => {
    const url = imgData.imageUrl || imgData.url;
    const img = document.createElement("img");
    img.src = url;
    img.className = "lgtm-thumb";
    img.setAttribute("referrerpolicy", "no-referrer");
    img.onerror = () => { img.style.display = "none"; };
    img.onmousedown = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };
    img.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      insertMarkdown(textarea, url);
      removeDialog(textarea);
    };
    grid.appendChild(img);
  });

  container.appendChild(grid);

  const refreshBtn = document.createElement("button");
  refreshBtn.className = "lgtm-refresh-btn";
  refreshBtn.innerHTML = "🔄 <span>Refresh Cats</span>";
  refreshBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    renderImages(container, textarea);
  };
  container.appendChild(refreshBtn);
}

// 5. ダイアログの削除（イベントリスナーを確実に解除する）
function removeDialog(textarea) {
  const dialog = document.querySelector(".lgtm-cat-dialog");
  if (!dialog) return;
  if (dialog._closeHandler) {
    document.removeEventListener("click", dialog._closeHandler);
  }
  textarea.focus();
  dialog.remove();
}

// 6. ダイアログ表示
function showLGTMDialog(button, textarea) {
  const existing = document.querySelector(".lgtm-cat-dialog");
  if (existing) {
    removeDialog(textarea);
    return;
  }

  const dialog = document.createElement("div");
  dialog.className = "lgtm-cat-dialog";

  // GitHubのレビューダイアログ内に配置し、外側クリック判定で閉じられるのを防ぐ
  const parentDialog = textarea.closest('[role="dialog"]') || document.body;
  parentDialog.appendChild(dialog);
  renderImages(dialog, textarea);

  // ボタン自身のクリックイベントが即座にcloseHandlerを発火させるのを防ぐ
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!dialog.contains(e.target) && e.target !== button) {
        removeDialog(textarea);
      }
    };
    dialog._closeHandler = closeHandler;
    document.addEventListener("click", closeHandler);
  }, 10);
}

// 7. ボタン注入（GitHubのツールバーを監視）
function injectButton() {
  const toolbars = document.querySelectorAll("markdown-toolbar");

  toolbars.forEach((toolbar) => {
    if (toolbar.dataset.lgtmInjected) return;

    // textarea を特定（複数の方法を試す）
    const textareaId = toolbar.getAttribute("for");
    const textarea = (textareaId && document.getElementById(textareaId))
      || toolbar.closest(".js-previewable-comment-form")?.querySelector("textarea")
      || toolbar.closest("form")?.querySelector("textarea");
    if (!textarea) return;

    // textarea が見つかってからフラグを立てる（失敗時は再試行可能）
    toolbar.dataset.lgtmInjected = 'true';

    const btn = document.createElement("button");
    btn.type = "button";
    const catIcon = document.createElement("img");
    catIcon.src = chrome.runtime.getURL("icons/cat.png");
    catIcon.width = 16;
    catIcon.height = 16;
    catIcon.style.cssText = "object-fit:contain;";
    btn.appendChild(catIcon);
    btn.className = "lgtm-cat-btn";
    btn.title = "LGTM Cat";

    btn.onclick = (e) => {
      e.preventDefault();
      showLGTMDialog(btn, textarea);
    };

    // ツールバーが非表示の場合（Primer MarkdownEditor）、可視ヘッダーにボタンを追加
    if (getComputedStyle(toolbar).display === "none") {
      const visibleHeader = toolbar.nextElementSibling?.firstElementChild;
      if (visibleHeader) {
        visibleHeader.appendChild(btn);
        return;
      }
    }

    // 通常のツールバーの末尾（右端）に追加する
    toolbar.appendChild(btn);
  });
}

// 監視開始（ページ遷移してもボタンを維持するため）
const observer = new MutationObserver(injectButton);
observer.observe(document.body, { childList: true, subtree: true });
injectButton();
