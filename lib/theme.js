import { getSettings, saveSettings } from "./storage.js";
export async function applyTheme(select) {
  const settings = await getSettings();
  const theme = settings.theme || "system";
  document.documentElement.dataset.theme = theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
  if (select) select.value = theme;
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async () => {
    const current = await getSettings();
    if (current.theme === "system") document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
}
export async function bindTheme(select) {
  await applyTheme(select);
  select?.addEventListener("change", async () => { await saveSettings({ theme: select.value }); await applyTheme(select); });
}
