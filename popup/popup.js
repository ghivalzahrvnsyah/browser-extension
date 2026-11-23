import { getActiveTab, getTabCookies, removeCookie, setCookie, validateCookie } from "../lib/cookies-api.js";
import { bindTheme } from "../lib/theme.js";
import { getSettings, saveSettings } from "../lib/storage.js";
import { serializeCookies } from "../lib/serializers.js";
import { parseCookies } from "../lib/parsers.js";
import { downloadText, hostname, toast } from "../lib/utils.js";

const $ = (selector) => document.querySelector(selector);
let tab, cookies = [], settings, activeStoreId = "0";

await bindTheme($("#theme"));
settings = await getSettings();
$("#autoRefresh").checked = settings.autoRefresh;
$("#exportFormat").value = ["json", "cookie-brother", "netscape", "cookie-header"].includes(settings.exportFormat) ? settings.exportFormat : "json";
$("#conflict").value = settings.conflict;
await loadCookies();

async function loadCookies() {
  try {
    tab = await getActiveTab();
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) throw new Error("Halaman ini tidak mengizinkan akses cookies.");
    const stores = await chrome.cookies.getAllCookieStores();
    activeStoreId = stores.find(store => store.tabIds?.includes(tab.id))?.id || "0";
    cookies = (await getTabCookies(tab.id)).filter(cookie => cookie.storeId === activeStoreId);
    $("#domain").textContent = hostname(tab.url) || "Tab aktif";
    render();
  } catch (error) {
    $("#domain").textContent = "Cookie tidak tersedia";
    $("#empty").hidden = false;
    $("#empty").textContent = error.message;
  }
}

function render() {
  const query = $("#search").value.toLowerCase();
  const matches = cookies.filter(cookie => `${cookie.name} ${cookie.value} ${cookie.domain}`.toLowerCase().includes(query));
  $("#count").textContent = `${cookies.length} cookies`;
  const body = $("#rows");
  body.replaceChildren();
  $("#empty").hidden = matches.length > 0;
  for (const cookie of matches.slice(0, 500)) {
    const row = document.createElement("tr");
    const name = document.createElement("td"); name.textContent = cookie.name;
    const domain = document.createElement("td"); domain.textContent = `${cookie.domain} · ${cookie.frame || "—"}`;
    const flags = document.createElement("td"); flags.textContent = [cookie.secure && "Secure", cookie.httpOnly && "HttpOnly", cookie.session && "Session"].filter(Boolean).join(" · ") || "—";
    const actions = document.createElement("td");
    const remove = document.createElement("button"); remove.textContent = "Hapus"; remove.className = "danger"; remove.setAttribute("aria-label", `Hapus ${cookie.name}`);
    remove.onclick = async () => {
      if (!confirm(`Hapus cookie ${cookie.name}?`)) return;
      await removeCookie(cookie);
      cookies = cookies.filter(item => item !== cookie);
      render(); toast("Cookie dihapus.");
    };
    actions.append(remove); row.append(name, domain, flags, actions); body.append(row);
  }
}

function matchesDomain(host, domain) {
  const normalizedHost = String(host || "").toLowerCase().replace(/^\.+/, "");
  const normalizedDomain = String(domain || "").toLowerCase().replace(/^\.+/, "");
  return Boolean(normalizedHost && normalizedDomain && (normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`)));
}
function key(cookie) { return JSON.stringify([cookie.name, cookie.domain, cookie.path, cookie.storeId, cookie.partitionKey || null]); }

$("#search").addEventListener("input", render);
$("#openEditor").onclick = () => chrome.runtime.sendMessage({ type: "OPEN_EDITOR", tabId: tab?.id });
$("#import").onclick = () => { $("#importDialog").showModal(); $("#importText").focus(); };
$("#export").onclick = () => $("#exportDialog").showModal();
document.querySelectorAll("[data-close]").forEach(button => button.onclick = () => $("#" + button.dataset.close).close());
$("#autoRefresh").onchange = async event => { settings.autoRefresh = event.target.checked; await saveSettings({ autoRefresh: event.target.checked }); };
$("#exportFormat").onchange = event => saveSettings({ exportFormat: event.target.value });

async function exportCookies(action) {
  if (!cookies.length) return toast("Tidak ada cookie untuk diekspor.");
  if (!confirm(`Data ekspor berisi kredensial sesi (${cookies.length} cookies). Lanjutkan? Simpan file dengan aman.`)) return;
  const format = $("#exportFormat").value;
  const content = serializeCookies(cookies, format, tab?.url || "");
  try {
    if (action === "copy") {
      await navigator.clipboard.writeText(content);
      toast("Cookie disalin ke clipboard.");
    } else {
      const text = format === "netscape" || format === "cookie-header";
      downloadText(content, text ? "cookies.txt" : "cookies.json", text ? "text/plain" : "application/json");
    }
    $("#exportDialog").close();
  } catch (error) { toast(`Aksi gagal: ${error.message}`); }
}
$("#copyExport").onclick = () => exportCookies("copy");
$("#downloadExport").onclick = () => exportCookies("file");

$("#deleteAll").onclick = async () => {
  if (!cookies.length || !confirm(`Hapus semua ${cookies.length} cookies yang terlihat di tab ini?`)) return;
  for (const cookie of cookies) try { await removeCookie(cookie); } catch {}
  cookies = []; render(); toast("Cookies dihapus.");
};

$("#file").onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast("Ukuran file melebihi 10 MB."); return; }
  $("#importText").value = await file.text();
};
$("#importDialog").addEventListener("dragover", event => event.preventDefault());
$("#importDialog").addEventListener("drop", async event => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file && file.size <= 10 * 1024 * 1024) $("#importText").value = await file.text();
  else toast("File kosong atau melebihi 10 MB.");
});
$("#conflict").onchange = event => saveSettings({ conflict: event.target.value });

$("#importNow").onclick = async () => {
  if (!tab?.id) return toast("Tab aktif tidak tersedia.");
  let incoming;
  try {
    incoming = parseCookies($("#importText").value, tab.url || "", "auto").map(cookie => ({ ...cookie, storeId: activeStoreId }));
    if (!incoming.length) throw new Error("Tidak ada cookie yang dikenali.");
  } catch (error) { toast(error.message); return; }

  const skip = $("#conflict").value === "skip";
  const onlyDomain = $("#activeDomainOnly").checked;
  const host = hostname(tab.url || "");
  const existing = new Set(cookies.map(key));
  const overwriteCount = incoming.filter(cookie => !cookie.warning && existing.has(key(cookie))).length;
  if (!skip && overwriteCount && !confirm(`${overwriteCount} cookie yang sudah ada akan ditimpa. Lanjutkan import?`)) return;

  let success = 0;
  const failures = [];
  for (const cookie of incoming) {
    if (cookie.warning) { failures.push(`${cookie.name}: ${cookie.warning}`); continue; }
    if (onlyDomain && !matchesDomain(host, cookie.domain)) { failures.push(`${cookie.name}: domain di luar tab ini`); continue; }
    if (skip && existing.has(key(cookie))) { failures.push(`${cookie.name}: dilewati karena sudah ada`); continue; }
    const errors = validateCookie(cookie);
    if (errors.length) { failures.push(`${cookie.name || "cookie"}: ${errors.join(" ")}`); continue; }
    try { await setCookie(cookie, activeStoreId); success++; }
    catch (error) { failures.push(`${cookie.name}: ${error.message}`); }
  }
  $("#importDialog").close();
  toast(`Import selesai: ${success} berhasil, ${failures.length} gagal/dilewati.`);
  if (failures.length) alert(`Hasil import\nBerhasil: ${success}\nGagal/dilewati: ${failures.length}\n\n${failures.slice(0, 25).join("\n")}`);
  if (success) {
    await loadCookies();
    if ($("#autoRefresh").checked) await chrome.tabs.reload(tab.id, { bypassCache: true });
  }
};
