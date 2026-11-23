export const esc = (value) => String(value ?? "");
export function downloadText(text, filename, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function copyText(text) { await navigator.clipboard.writeText(text); }
export function toast(message) { const el = document.querySelector("#toast"); if (!el) return; el.textContent = message; el.hidden = false; setTimeout(() => { el.hidden = true; }, 3000); }
export function hostname(url) { try { return new URL(url).hostname; } catch { return ""; } }
