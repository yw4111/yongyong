// Re-inject content script when the extension is updated/installed
// so existing tabs get the script without requiring a reload.
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        }).catch(() => {}); // ignore tabs we can't inject into
        chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content.css"],
        }).catch(() => {});
      }
    });
  });
});
