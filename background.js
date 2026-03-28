const FETCH_TIMEOUT_MS = 10000;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchLGTMImages") {
    const API_URL = "https://lgtmeow.com/api/lgtm-images";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(API_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        sendResponse({ success: true, data });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      })
      .finally(() => clearTimeout(timeoutId));

    // 非同期で sendResponse を呼ぶために true を返す
    return true;
  }
});
