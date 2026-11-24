import { getActiveTab, getTabCookies, getDomainCookies, cookieKey, setCookie, removeCookie, validateCookie, withCookieModel } from "../lib/cookies-api.js";
import { bindTheme } from "../lib/theme.js";
import { getSettings, saveSettings } from "../lib/storage.js";
import { parseCookies } from "../lib/parsers.js";
import { serializeCookies } from "../lib/serializers.js";
import { downloadText, copyText, hostname, toast } from "../lib/utils.js";

const $ = s => document.querySelector(s); let tab, cookies = [], stores = [], mode = "tab", sort = "domain", ascending = true;
const matchesDomain = (host, domain) => { const h = String(host || "").toLowerCase().replace(/^\.+/, ""); const d = String(domain || "").toLowerCase().replace(/^\.+/, ""); return Boolean(h && d && (h === d || h.endsWith(`.${d}`))); };
const params = new URLSearchParams(location.search); const requestedTabId = Number(params.get("tabId"));
	await bindTheme($("#theme")); const settings = await getSettings(); $("#mask").checked = settings.maskValues; $("#conflict").value = settings.conflict; $("#exportFormat").value = settings.exportFormat; $("#refreshScope").value = settings.refreshScope; $("#autoRefreshClear").checked = settings.autoRefreshAfterClear; $("#domainInput").value = params.get("domain") || "";
tab = Number.isInteger(requestedTabId) && requestedTabId > 0 ? await chrome.tabs.get(requestedTabId).catch(() => null) : await getActiveTab();
stores = await chrome.cookies.getAllCookieStores(); for (const s of stores) { const o = document.createElement("option"); o.value = s.id; o.textContent = `${s.id}${s.tabIds?.includes(tab?.id) ? " (tab aktif)" : ""}`; $("#store").append(o); }
if (tab?.id != null) $("#store").value = stores.find(s => s.tabIds?.includes(tab.id))?.id || stores[0]?.id || "";
if (params.get("domain")) { mode = "domain"; document.querySelector('input[name="mode"][value="domain"]').checked = true; }
await loadCookies();
async function loadCookies() {
  $("#empty").hidden = true;
  try {
    if (mode === "tab") cookies = tab?.id != null ? await getTabCookies(tab.id) : [];
    else if (mode === "domain") cookies = await getDomainCookies($("#domainInput").value, $("#store").value);
    else cookies = (await chrome.cookies.getAll({})).map(withCookieModel);
    const selectedStore = $("#store").value; if (selectedStore) cookies = cookies.filter(c => c.storeId === selectedStore);
    $("#summary").textContent = `${cookies.length} cookies · ${mode === "tab" ? hostname(tab?.url || "") || "Tab aktif" : mode === "domain" ? $("#domainInput").value : "Semua domain"}`;
    render();
  } catch (e) { toast(`Gagal membaca cookies: ${e.message}`); }
}
async function refreshAfterClear() {
  if ($("#autoRefreshClear").checked && tab?.id != null) {
    try { await chrome.tabs.reload(tab.id, { bypassCache: true }); } catch {}
  }
}
function filtered() {
  const q = $("#search").value.toLowerCase();
  return cookies.filter(c => (!q || `${c.name} ${c.value} ${c.domain}`.toLowerCase().includes(q)) && (!$("#secureFilter").checked || c.secure) && (!$("#httpOnlyFilter").checked || c.httpOnly) && (!$("#sessionFilter").checked || c.session));
}
function render() {
  const rows = filtered().sort((a,b) => String(a[sort] ?? "").localeCompare(String(b[sort] ?? "")) * (ascending ? 1 : -1));
  const counts = new Map(); for (const c of cookies) counts.set(c.domain, (counts.get(c.domain) || 0) + 1);
  $("#groupCount").textContent = `${counts.size} domain${counts.size === 1 ? "" : "s"}`;
  const body = $("#rows"); body.replaceChildren(); $("#empty").hidden = rows.length > 0;
  let lastDomain = "";
  for (const c of rows.slice(0, 2000)) {
    if (mode === "all" && c.domain !== lastDomain) { lastDomain = c.domain; const g = document.createElement("tr"); g.className = "group-label"; const td = document.createElement("td"); td.colSpan = 11; td.textContent = `${lastDomain} · ${counts.get(lastDomain)} cookies`; g.append(td); body.append(g); }
    const tr = document.createElement("tr"); const check = document.createElement("input"); check.type = "checkbox"; check.className = "row-check"; check.setAttribute("aria-label", `Pilih ${c.name}`); const tdCheck = document.createElement("td"); tdCheck.append(check); tr.append(tdCheck);
    const vals = [c.name, $("#mask").checked ? "••••••••" : c.value, c.domain, c.path, c.session ? "Session" : c.expirationDate ? new Date(c.expirationDate * 1000).toLocaleString() : "—", c.secure ? "✓" : "", c.httpOnly ? "✓" : "", c.sameSite || "unspecified", c.frame || "—"];
    for (const val of vals) { const td = document.createElement("td"); td.textContent = val; tr.append(td); }
    const actions = document.createElement("td"); const edit = document.createElement("button"); edit.textContent = "Edit"; edit.onclick = () => fillForm(c); actions.append(edit); const del = document.createElement("button"); del.textContent = "×"; del.className = "danger"; del.setAttribute("aria-label", `Hapus ${c.name}`); del.onclick = async () => { if (confirm(`Hapus cookie ${c.name} dari ${c.domain}?`)) { const removed = await removeCookie(c); if (removed) { cookies = cookies.filter(x => cookieKey(x) !== cookieKey(c)); render(); toast("Cookie dihapus."); await refreshAfterClear(); } } }; actions.append(del); tr.append(actions); body.append(tr);
  }
  $("#selectAll").checked = false;
}
function selectedCookies() { return [...document.querySelectorAll("#rows tr")].filter(r => r.querySelector(".row-check")?.checked).map(r => { const name = r.children[1]?.textContent; const domain = r.children[3]?.textContent; return cookies.find(c => c.name === name && c.domain === domain); }).filter(Boolean); }
function fillForm(c = null) { $("#cookieForm").reset(); $("#formError").textContent = ""; $("#original").value = c ? cookieKey(c) : ""; $("#formTitle").textContent = c ? `Edit cookie · ${c.name}` : "Tambah cookie"; if (!c) { $("#fDomain").value = hostname(tab?.url || ""); return; } $("#fName").value = c.name; $("#fValue").value = c.value; $("#fDomain").value = c.domain; $("#fPath").value = c.path; $("#fSameSite").value = c.sameSite || "unspecified"; $("#fExpiry").value = c.session ? "" : c.expirationDate || ""; $("#fHostOnly").checked = c.hostOnly; $("#fSecure").checked = c.secure; $("#fHttpOnly").checked = c.httpOnly; }
$("#cookieForm").onsubmit = async e => { e.preventDefault(); const c = { name: $("#fName").value, value: $("#fValue").value, domain: $("#fDomain").value.trim(), hostOnly: $("#fHostOnly").checked, path: $("#fPath").value, secure: $("#fSecure").checked, httpOnly: $("#fHttpOnly").checked, sameSite: $("#fSameSite").value, session: !$("#fExpiry").value, expirationDate: $("#fExpiry").value ? Number($("#fExpiry").value) : undefined, storeId: $("#store").value };
  const errors = validateCookie(c); if (errors.length) { $("#formError").textContent = errors.join(" "); return; }
  try { const originalKey = $("#original").value; const original = cookies.find(x => cookieKey(x) === originalKey); await setCookie(c); if (original && originalKey !== cookieKey(c)) await removeCookie(original); cookies = cookies.filter(x => cookieKey(x) !== originalKey && cookieKey(x) !== cookieKey(c)); cookies.push(c); render(); fillForm(); toast("Cookie disimpan."); } catch (err) { $("#formError").textContent = err.message; }
};
$("#clearForm").onclick = () => fillForm(); $("#add").onclick = () => fillForm();
$("#selectAll").onchange = e => document.querySelectorAll(".row-check").forEach(x => x.checked = e.target.checked);
$("#deleteSelected").onclick = async () => { const picked = selectedCookies(); if (!picked.length) return toast("Pilih cookie terlebih dahulu."); if (!confirm(`Hapus ${picked.length} cookies terpilih?`)) return; const removedKeys = new Set(); for (const c of picked) try { if (await removeCookie(c)) removedKeys.add(cookieKey(c)); } catch {} cookies = cookies.filter(c => !removedKeys.has(cookieKey(c))); render(); toast(`${removedKeys.size} cookies dihapus.`); if (removedKeys.size) await refreshAfterClear(); };
$("#deleteDomain").onclick = async () => { const domain = $("#domainInput").value.trim() || hostname(tab?.url || ""); if (!domain || !confirm(`Hapus semua cookies untuk ${domain} dan subdomainnya pada store ini?`)) return; const all = await getDomainCookies(domain, $("#store").value); let removed = 0; for (const c of all) try { if (await removeCookie(c)) removed++; } catch {} const removedKeys = new Set(all.map(cookieKey)); cookies = cookies.filter(c => !removedKeys.has(cookieKey(c))); render(); toast(`${removed} cookies dihapus.`); if (removed) await refreshAfterClear(); };
$("#refresh").onclick = loadCookies; $("#loadDomain").onclick = () => { mode = "domain"; document.querySelector('input[name="mode"][value="domain"]').checked = true; loadCookies(); };
document.querySelectorAll('input[name="mode"]').forEach(r => r.onchange = e => { mode = e.target.value; loadCookies(); }); $("#store").onchange = loadCookies;
for (const id of ["search","secureFilter","httpOnlyFilter","sessionFilter","mask"]) $("#"+id).addEventListener("input", render); $("#mask").onchange = async e => { await saveSettings({ maskValues: e.target.checked }); render(); };
document.querySelectorAll("th[data-sort]").forEach(th => th.onclick = () => { if (sort === th.dataset.sort) ascending = !ascending; else { sort = th.dataset.sort; ascending = true; } render(); });
$("#exportFormat").onchange = e => saveSettings({ exportFormat: e.target.value });
$("#refreshScope").onchange = e => saveSettings({ refreshScope: e.target.value });
$("#autoRefreshClear").onchange = e => saveSettings({ autoRefreshAfterClear: e.target.checked });
async function exportCookies(action) { const chosen = selectedCookies(); const list = chosen.length ? chosen : filtered(); if (!list.length) return toast("Tidak ada cookie untuk diekspor."); if (!confirm(`Ekspor ${list.length} cookies? Data berisi kredensial sesi. Simpan file dengan aman dan hapus setelah digunakan.`)) return; const fmt = $("#exportFormat").value; const data = serializeCookies(list, fmt, tab?.url || ""); try { if (action === "copy") { await copyText(data); toast("Cookie disalin ke clipboard."); } else { const text = fmt === "netscape" || fmt === "cookie-header"; downloadText(data, text ? "cookies.txt" : "cookies.json", text ? "text/plain" : "application/json"); } } catch (e) { toast(`Aksi gagal: ${e.message}`); } $(".export-menu").open = false; }
$("#copyExport").onclick = () => exportCookies("copy"); $("#downloadExport").onclick = () => exportCookies("file");

$("#importFocus").onclick = () => { $("#importText").focus(); $("#importPanel").scrollIntoView({ behavior: "smooth" }); };
$("#file").onchange = async e => { const file = e.target.files[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) return toast("Ukuran file melebihi 10 MB."); $("#importText").value = await file.text(); };
$("#importPanel").addEventListener("dragover", e => { e.preventDefault(); $("#importPanel").classList.add("drag"); }); $("#importPanel").addEventListener("dragleave", () => $("#importPanel").classList.remove("drag")); $("#importPanel").addEventListener("drop", async e => { e.preventDefault(); $("#importPanel").classList.remove("drag"); const file = e.dataTransfer.files[0]; if (file && file.size <= 10 * 1024 * 1024) $("#importText").value = await file.text(); else toast("File kosong atau melebihi 10 MB."); });
$("#activeDomainOnly").checked = false;
$("#conflict").onchange = async e => saveSettings({ conflict: e.target.value });
$("#importNow").onclick = async () => {
  const targetHost = hostname(tab?.url || "");
  let incoming;
  try {
    incoming = parseCookies($("#importText").value, tab?.url || "", $("#importFormat").value).map(c => ({ ...c, storeId: $("#store").value }));
    if (!incoming.length) throw new Error("Tidak ada cookie yang dapat diparse.");
  } catch (e) { toast(e.message); return; }
  const onlyDomain = $("#activeDomainOnly").checked;
  const skip = $("#conflict").value === "skip";
  const existing = new Set(cookies.map(cookieKey));
  const overwriteCount = incoming.filter(c => !c.warning && existing.has(cookieKey(c))).length;
  if (!skip && overwriteCount && !confirm(`${overwriteCount} cookie yang sudah ada akan ditimpa. Lanjutkan import?`)) return;
  let success = 0;
  const failures = [];
  for (const c of incoming) {
    if (c.warning) { failures.push(`${c.name || "cookie"}: ${c.warning}`); continue; }
    if (onlyDomain && targetHost && !matchesDomain(targetHost, c.domain)) { failures.push(`${c.name}: domain di luar tab aktif`); continue; }
    if (skip && existing.has(cookieKey(c))) { failures.push(`${c.name}: dilewati karena sudah ada`); continue; }
    const errors = validateCookie(c);
    if (errors.length) { failures.push(`${c.name || "cookie"}: ${errors.join(" ")}`); continue; }
    try { await setCookie(c, $("#store").value); success++; }
    catch (e) { failures.push(`${c.name}: ${e.message}`); }
  }
  toast(`Import selesai: ${success} berhasil, ${failures.length} gagal/dilewati.`);
  if (failures.length) alert(`Hasil import\nBerhasil: ${success}\nGagal/dilewati: ${failures.length}\n\n${failures.slice(0,30).join("\n")}`);
  if (success) {
    await loadCookies();
    const s = await getSettings();
    if (s.autoRefresh && tab?.id != null) {
      if (s.refreshScope === "domain") {
        const tabs = await chrome.tabs.query({});
        for (const t of tabs) if (hostname(t.url || "") === targetHost) chrome.tabs.reload(t.id, { bypassCache: true }).catch(() => {});
      } else chrome.tabs.reload(tab.id, { bypassCache: true });
    }
  }
};
