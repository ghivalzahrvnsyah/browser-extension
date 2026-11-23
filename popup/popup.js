import { getActiveTab, getTabCookies, removeCookie } from "../lib/cookies-api.js";
import { bindTheme } from "../lib/theme.js";
import { getSettings, saveSettings } from "../lib/storage.js";
import { serializeCookies } from "../lib/serializers.js";
import { parseCookies } from "../lib/parsers.js";
import { setCookie, validateCookie } from "../lib/cookies-api.js";
import { downloadText, hostname, toast } from "../lib/utils.js";

const $ = (s) => document.querySelector(s); let tab, cookies = [], settings, activeStoreId = "0";
await bindTheme($("#theme")); settings = await getSettings(); $("#autoRefresh").checked = settings.autoRefresh; $("#exportFormat").value = ["json","cookie-brother","netscape","cookie-header"].includes(settings.exportFormat) ? settings.exportFormat : "json"; $("#conflict").value = settings.conflict;
await loadCookies();
async function loadCookies() {
  try { tab = await getActiveTab(); if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) throw new Error("Halaman ini tidak mengizinkan akses cookies."); const stores = await chrome.cookies.getAllCookieStores(); activeStoreId = stores.find(s => s.tabIds?.includes(tab.id))?.id || "0"; cookies = (await getTabCookies(tab.id)).filter(c => c.storeId === activeStoreId); $("#domain").textContent = hostname(tab.url) || "Tab aktif"; render(); }
  catch (e) { $("#domain").textContent = "Cookie tidak tersedia"; $("#empty").hidden = false; $("#empty").textContent = e.message; }
}
function render() {
  const q = $("#search").value.toLowerCase(); const matches = cookies.filter(c => `${c.name} ${c.value} ${c.domain}`.toLowerCase().includes(q));
  $("#count").textContent = `${cookies.length} cookies`; const body = $("#rows"); body.replaceChildren(); $("#empty").hidden = matches.length > 0;
  for (const c of matches.slice(0, 500)) { const tr = document.createElement("tr");
    const name = document.createElement("td"); name.textContent = c.name;
    const domain = document.createElement("td"); domain.textContent = `${c.domain} · ${c.frame || "—"}`;
    const flags = document.createElement("td"); flags.textContent = [c.secure && "Secure", c.httpOnly && "HttpOnly", c.session && "Session"].filter(Boolean).join(" · ") || "—";
    const action = document.createElement("td"); const del = document.createElement("button"); del.textContent = "Hapus"; del.setAttribute("aria-label", `Hapus ${c.name}`); del.onclick = async () => { if (!confirm(`Hapus cookie ${c.name}?`)) return; await removeCookie(c); cookies = cookies.filter(x => x !== c); render(); toast("Cookie dihapus."); }; action.append(del); tr.append(name, domain, flags, action); body.append(tr);
  }
}
$("#search").addEventListener("input", render);
$("#openEditor").onclick = () => chrome.runtime.sendMessage({ type: "OPEN_EDITOR", tabId: tab?.id });
$("#import").onclick = () => { $("#importPanel").open = true; $("#importText").focus(); };
$("#autoRefresh").onchange = async (e) => { settings.autoRefresh = e.target.checked; await saveSettings({ autoRefresh: e.target.checked }); };
$("#exportFormat").onchange = (e) => saveSettings({ exportFormat: e.target.value });
async function exportCookies(action) { if (!cookies.length) return toast("Tidak ada cookie untuk diekspor."); if (!confirm(`Data ekspor berisi kredensial sesi (${cookies.length} cookies). Lanjutkan? Simpan file dengan aman dan hapus setelah digunakan.`)) return; const fmt = $("#exportFormat").value; const content = serializeCookies(cookies, fmt, tab?.url || ""); try { if (action === "copy") { await navigator.clipboard.writeText(content); toast("Cookie disalin ke clipboard."); } else { const text = fmt === "netscape" || fmt === "cookie-header"; downloadText(content, text ? "cookies.txt" : "cookies.json", text ? "text/plain" : "application/json"); } } catch (e) { toast(`Aksi gagal: ${e.message}`); } $(".export-menu").open = false; }
$("#copyExport").onclick = () => exportCookies("copy"); $("#downloadExport").onclick = () => exportCookies("file");
$("#deleteAll").onclick = async () => { if (!cookies.length || !confirm(`Hapus semua ${cookies.length} cookies yang terlihat di tab ini?`)) return; for (const c of cookies) try { await removeCookie(c); } catch {} cookies = []; render(); toast("Cookies dihapus."); };

let parsed = [];
const matchesDomain = (host, domain) => { const h = String(host || "").toLowerCase().replace(/^\.+/, ""); const d = String(domain || "").toLowerCase().replace(/^\.+/, ""); return Boolean(h && d && (h === d || h.endsWith(`.${d}`))); };
$("#file").onchange = async e => { const file = e.target.files[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) return toast("Ukuran file melebihi 10 MB."); $("#importText").value = await file.text(); };
$("#importPanel").addEventListener("dragover", e => e.preventDefault());
$("#importPanel").addEventListener("drop", async e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && file.size <= 10 * 1024 * 1024) $("#importText").value = await file.text(); else toast("File kosong atau melebihi 10 MB."); });
$("#preview").onclick = async () => { try { parsed = parseCookies($("#importText").value, tab?.url || "", $("#importFormat").value).map(c => ({ ...c, storeId: activeStoreId })); if (!parsed.length) throw new Error("Tidak ada cookie yang dikenali."); drawPreview(); } catch (e) { parsed = []; $("#previewArea").hidden = true; toast(e.message); } };
function drawPreview() { const body = $("#previewRows"); body.replaceChildren(); const existing = new Set(cookies.map(c => JSON.stringify([c.name,c.domain,c.path,c.storeId,c.partitionKey||null]))); let warnings = 0; const host = hostname(tab?.url || ""); for (const c of parsed.slice(0,500)) { const notes = validateCookie(c); if (c.warning) notes.push(c.warning); if (c.domain && host && !matchesDomain(host,c.domain)) notes.push("Domain berbeda dari tab aktif"); const key = JSON.stringify([c.name,c.domain,c.path,c.storeId,c.partitionKey||null]); if (existing.has(key)) notes.push($("#conflict").value === "skip" ? "Akan dilewati" : "Akan ditimpa"); if (notes.length) warnings++; const tr = document.createElement("tr"); for (const text of [c.name || "(tanpa nama)",c.domain || "(tanpa domain)",notes.join(" · ") || "Siap"]) { const td = document.createElement("td"); td.textContent = text; tr.append(td); } body.append(tr); } $("#previewSummary").textContent = `${parsed.length} cookies terdeteksi · ${warnings} baris memiliki catatan.`; $("#previewArea").hidden = false; }
$("#conflict").onchange = async e => { await saveSettings({ conflict: e.target.value }); if (parsed.length) drawPreview(); };
$("#applyImport").onclick = async () => { if (!tab?.id) return toast("Tab aktif tidak tersedia."); const skip = $("#conflict").value === "skip", onlyDomain = $("#activeDomainOnly").checked, host = hostname(tab.url || ""); const existing = new Set(cookies.map(c => JSON.stringify([c.name,c.domain,c.path,c.storeId,c.partitionKey||null]))); let ok = 0; const failed = []; for (const c of parsed) { if (c.warning) { failed.push(`${c.name}: ${c.warning}`); continue; } if (onlyDomain && !matchesDomain(host,c.domain)) { failed.push(`${c.name}: domain di luar tab aktif`); continue; } const key = JSON.stringify([c.name,c.domain,c.path,c.storeId,c.partitionKey||null]); if (skip && existing.has(key)) { failed.push(`${c.name}: dilewati karena sudah ada`); continue; } const errors = validateCookie(c); if (errors.length) { failed.push(`${c.name}: ${errors.join(" ")}`); continue; } try { await setCookie(c,activeStoreId); ok++; } catch (e) { failed.push(`${c.name}: ${e.message}`); } } toast(`Import selesai: ${ok} berhasil, ${failed.length} gagal/dilewati.`); if (failed.length) alert(`Hasil import\nBerhasil: ${ok}\nGagal/dilewati: ${failed.length}\n\n${failed.slice(0,25).join("\n")}`); if (ok) { await loadCookies(); if ($("#autoRefresh").checked) await chrome.tabs.reload(tab.id,{bypassCache:true}); } };
