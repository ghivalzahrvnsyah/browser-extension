const defaults = { theme: "system", autoRefresh: true, refreshScope: "active", conflict: "overwrite", maskValues: true, exportFormat: "json" };
export async function getSettings() { return { ...defaults, ...(await chrome.storage.local.get(defaults)) }; }
export async function saveSettings(patch) { await chrome.storage.local.set(patch); }
