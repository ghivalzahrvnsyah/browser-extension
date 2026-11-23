export const cookieKey = (c) => JSON.stringify([c.name, c.domain, c.path, c.storeId, c.partitionKey || null]);
export const withCookieModel = (cookie) => ({ ...cookie, hostOnly: !String(cookie.domain || "").startsWith(".") });

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

export async function getTabCookies(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const urls = new Map();
  if (tab.url) urls.set(tab.url, "top");
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    for (const frame of frames || []) if (frame.url) {
      const label = frame.frameId === 0 ? "top" : `frame ${frame.frameId}`;
      if (!urls.has(frame.url)) urls.set(frame.url, label);
    }
  } catch { /* Some browser pages do not expose frame navigation. */ }
  const stores = await chrome.cookies.getAllCookieStores();
  const rows = new Map();
  await Promise.all([...urls].flatMap(([url, frame]) => stores.map(async (store) => {
    try {
      const cookies = await chrome.cookies.getAll({ url, storeId: store.id });
      for (const cookie of cookies) {
        const key = cookieKey(cookie);
        const row = rows.get(key) || { ...withCookieModel(cookie), frame };
        if (frame === "top") row.frame = "top";
        rows.set(key, row);
      }
    } catch { /* Invalid/restricted URLs are skipped. */ }
  })));
  return [...rows.values()];
}

export async function getDomainCookies(domain, storeId) {
  const clean = domain.trim().replace(/^\.+/, "");
  if (!clean) return [];
  const query = { domain: clean }; if (storeId) query.storeId = storeId;
  return (await chrome.cookies.getAll(query)).map(withCookieModel);
}

export function cookieUrl(cookie) {
  const host = String(cookie.domain || "").replace(/^\.+/, "");
  if (!host || /[^a-z0-9.:[\]-]/i.test(host)) throw new Error("Domain cookie tidak valid.");
  return `${cookie.secure ? "https" : "http"}://${host}${cookie.path?.startsWith("/") ? cookie.path : "/"}`;
}

export function validateCookie(cookie) {
  const errors = [];
  if (!cookie.name) errors.push("Nama cookie wajib diisi.");
  if (!cookie.domain) errors.push("Domain wajib diisi.");
  if (!cookie.path?.startsWith("/")) errors.push("Path harus diawali /.");
  if (cookie.name.startsWith("__Secure-") && !cookie.secure) errors.push("Cookie __Secure- harus Secure.");
  if (cookie.name.startsWith("__Host-") && (!cookie.secure || cookie.path !== "/" || !cookie.hostOnly)) errors.push("Cookie __Host- harus Secure, Path=/, dan host-only.");
  if (cookie.sameSite === "no_restriction" && !cookie.secure) errors.push("SameSite=None harus Secure.");
  if (!cookie.session && cookie.expirationDate && cookie.expirationDate <= Date.now() / 1000) errors.push("Cookie sudah kedaluwarsa.");
  try { cookieUrl(cookie); } catch (e) { errors.push(e.message); }
  return errors;
}

export async function setCookie(cookie, storeId) {
  const errors = validateCookie(cookie);
  if (errors.length) throw new Error(errors.join(" "));
  const details = {
    url: cookieUrl(cookie), name: cookie.name, value: cookie.value ?? "", path: cookie.path || "/",
    secure: Boolean(cookie.secure), httpOnly: Boolean(cookie.httpOnly), sameSite: cookie.sameSite || "unspecified",
    storeId: cookie.storeId || storeId
  };
  if (!cookie.hostOnly && cookie.domain) details.domain = cookie.domain;
  if (!cookie.session && Number.isFinite(Number(cookie.expirationDate))) details.expirationDate = Number(cookie.expirationDate);
  if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
  const result = await chrome.cookies.set(details);
  if (!result) throw new Error("Browser menolak cookie.");
  return result;
}

export async function removeCookie(cookie) {
  const details = { url: cookieUrl(cookie), name: cookie.name, storeId: cookie.storeId };
  if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
  return chrome.cookies.remove(details);
}
