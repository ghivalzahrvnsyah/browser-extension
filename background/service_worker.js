chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "search-domain", title: "Search Cookies by Domain", contexts: ["action"] });
    chrome.contextMenus.create({ id: "open-editor", title: "Open Cookie Editor in new Tab", contexts: ["action"] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = tab?.url || "";
  let domain = "";
  try { domain = new URL(url).hostname; } catch { /* restricted browser page */ }
  const editor = chrome.runtime.getURL("editor/editor.html");
  const params = new URLSearchParams();
  if (tab?.id != null) params.set("tabId", String(tab.id));
  if (info.menuItemId === "search-domain" && domain) params.set("domain", domain);
  chrome.tabs.create({ url: `${editor}?${params}` });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "OPEN_EDITOR") {
    const params = new URLSearchParams();
    if (Number.isInteger(message.tabId)) params.set("tabId", String(message.tabId));
    if (message.domain) params.set("domain", message.domain);
    chrome.tabs.create({ url: `${chrome.runtime.getURL("editor/editor.html")}?${params}` })
      .then((tab) => sendResponse({ tabId: tab.id }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});
