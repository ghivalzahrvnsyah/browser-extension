const mapSameSite = (v) => ({ strict: "strict", lax: "lax", none: "no_restriction", no_restriction: "no_restriction", unspecified: "unspecified" }[String(v ?? "").toLowerCase()] || "unspecified");
function baseCookie(c = {}, targetUrl = "") {
  let host = c.domain ?? c.host_key ?? "";
  let hostOnly = c.hostOnly ?? c.host_only;
  if (!host && targetUrl) { try { host = new URL(targetUrl).hostname; hostOnly = true; } catch {} }
  if (typeof host === "string" && host.startsWith(".")) hostOnly = false;
  let expiryValue = c.expirationDate ?? c.expires;
  if (typeof expiryValue === "string" && expiryValue && !Number.isFinite(Number(expiryValue))) { const parsed = Date.parse(expiryValue); expiryValue = Number.isFinite(parsed) ? parsed / 1000 : undefined; }
  const session = c.session === true || Number(expiryValue) === -1 || expiryValue == null;
  return {
    name: String(c.name ?? ""), value: String(c.value ?? ""), domain: String(host), hostOnly: hostOnly !== false,
    path: String(c.path || "/"), secure: Boolean(c.secure ?? c.is_secure), httpOnly: Boolean(c.httpOnly ?? c.httponly ?? c.is_httponly),
    sameSite: mapSameSite(c.sameSite ?? c.samesite), session,
    expirationDate: session ? undefined : Number(expiryValue),
    storeId: c.storeId, partitionKey: c.partitionKey
  };
}
function parseJson(text, target) {
  let data;
  try { data = JSON.parse(text); }
  catch (error) {
    // Some cookie exporters leave an empty expirationDate for session cookies.
    const repaired = text.replace(/("expirationDate"\s*:\s*)(?=[,}])/g, "$1null");
    if (repaired === text) throw error;
    data = JSON.parse(repaired);
  }
  if (Array.isArray(data)) return data.some(c => c && (c.host_key !== undefined || c.expires_utc !== undefined)) ? parseSqlite(data, target) : data.map(c => baseCookie(c, target));
  if (data?.format === "cookie-brother" && Array.isArray(data.cookies)) return data.cookies.map(c => baseCookie(c, target));
  if (Array.isArray(data?.cookies)) return data.cookies.map(c => baseCookie(c, target));
  if (Array.isArray(data?.log?.entries)) return parseHar(data, target);
  if (Array.isArray(data) === false && (data?.host_key !== undefined || data?.expires_utc !== undefined)) return parseSqlite([data], target);
  throw new Error("JSON tidak dikenali. Harus berisi cookies[], array cookie, HAR, atau baris SQLite.");
}
function parseNetscape(text) {
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let line = raw, httpOnly = false;
    if (line.startsWith("#HttpOnly_")) { httpOnly = true; line = line.slice(10); }
    else if (line.startsWith("#")) continue;
    const p = line.split("\t");
    if (p.length !== 7) continue;
    const expiry = Number(p[4]);
    rows.push(baseCookie({ domain: p[0], hostOnly: p[1].toUpperCase() !== "TRUE", path: p[2], secure: p[3].toUpperCase() === "TRUE", expirationDate: expiry || undefined, session: !expiry, name: p[5], value: p[6], httpOnly }));
  }
  return rows;
}
function parseHeader(text, target) {
  const pairs = text.replace(/^(Cookie|Cookie:|cookie:)\s*/i, "").trim().split(/;\s*/);
  const rows = pairs.filter(Boolean).map(pair => { const i = pair.indexOf("="); return baseCookie({ name: i < 0 ? pair.trim() : pair.slice(0, i).trim(), value: i < 0 ? "" : pair.slice(i + 1).trim() }, target); });
  return rows;
}
function parseSetCookie(text, target) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const rows = [];
  for (let line of lines) {
    line = line.replace(/^Set-Cookie:\s*/i, "");
    const parts = line.split(";").map(x => x.trim());
    const idx = parts[0]?.indexOf("="); if (idx < 0) continue;
    const c = { name: parts[0].slice(0, idx).trim(), value: parts[0].slice(idx + 1), path: "/", session: true };
    let maxAge;
    for (const attr of parts.slice(1)) {
      const i = attr.indexOf("="); const key = (i < 0 ? attr : attr.slice(0, i)).trim().toLowerCase(); const val = i < 0 ? "" : attr.slice(i + 1).trim();
      if (key === "domain") { c.domain = val; c.hostOnly = false; }
      else if (key === "path") c.path = val || "/";
      else if (key === "secure") c.secure = true;
      else if (key === "httponly") c.httpOnly = true;
      else if (key === "samesite") c.sameSite = mapSameSite(val);
      else if (key === "expires") { const t = Date.parse(val); if (Number.isFinite(t)) c.expirationDate = t / 1000; }
      else if (key === "max-age") maxAge = Number(val);
      else if (key === "partitioned") c.partitioned = true;
    }
    if (maxAge !== undefined) { c.expirationDate = Date.now() / 1000 + maxAge; c.session = false; }
    else c.session = !c.expirationDate;
    if (c.partitioned && target) { try { c.partitionKey = { topLevelSite: new URL(target).origin }; } catch {} }
    rows.push(baseCookie(c, target));
  }
  return rows;
}
function parseHar(data, target) {
  const rows = [];
  for (const entry of data.log.entries) {
    let url = entry.request?.url || target;
    const push = (c, fallbackUrl) => rows.push(baseCookie({ ...c, domain: c.domain || (() => { try { return new URL(fallbackUrl).hostname; } catch { return ""; } })() }, fallbackUrl));
    for (const c of entry.request?.cookies || []) push(c, url);
    for (const c of entry.response?.cookies || []) push(c, url);
    if (!(entry.request?.cookies?.length || entry.response?.cookies?.length)) {
      const h = entry.request?.headers?.find(x => x.name.toLowerCase() === "cookie")?.value;
      const sh = entry.response?.headers?.filter(x => x.name.toLowerCase() === "set-cookie").map(x => `Set-Cookie: ${x.value}`).join("\n");
      if (h) rows.push(...parseHeader(h, url)); if (sh) rows.push(...parseSetCookie(sh, url));
    }
  }
  return rows;
}
function parseSqlite(items, target) {
  return items.map(c => {
    const expiry = Number(c.expires_utc || 0);
    const normalized = { ...c, domain: c.host_key ?? c.domain, hostOnly: !(String(c.host_key ?? c.domain ?? "").startsWith(".")), secure: Boolean(c.is_secure), httpOnly: Boolean(c.is_httponly), sameSite: ({ "-1": "unspecified", 0: "no_restriction", 1: "lax", 2: "strict" })[String(c.samesite)] || "unspecified", expirationDate: expiry ? expiry / 1000000 - 11644473600 : undefined, session: !expiry };
    const result = baseCookie(normalized, target);
    if (!c.value && c.encrypted_value) result.warning = "encrypted_value tidak didekripsi; cookie dilewati.";
    return result;
  });
}

export function detectFormat(text) {
  const t = text.trim(); if (!t) return "unknown";
  try {
    const d = JSON.parse(t);
    if (d?.format === "cookie-brother") return "cookie-brother";
    if (d?.log?.entries) return "har";
    if (d?.host_key !== undefined || d?.expires_utc !== undefined) return "chrome-sqlite";
    if (d?.cookies && Array.isArray(d.cookies)) return "storage-state";
    if (Array.isArray(d)) return "json";
  } catch {}
  if (t.startsWith("[") || t.startsWith("{")) return "json";
  if (/^# Netscape HTTP Cookie File/m.test(t) || t.split(/\r?\n/).some(x => x.split("\t").length === 7 && !x.startsWith("#"))) return "netscape";
  if (/^\s*Set-Cookie:/im.test(t) || /;\s*(Path|Domain|Expires|Max-Age|HttpOnly|Secure|SameSite)=?/i.test(t)) return "set-cookie";
  if (/^[^;\r\n=]+=[^;\r\n]*/.test(t)) return "cookie-header";
  return "unknown";
}
export function parseCookies(text, targetUrl = "", format = "auto") {
  if (text.length > 10 * 1024 * 1024) throw new Error("Ukuran input melebihi batas 10 MB.");
  const kind = format === "auto" ? detectFormat(text) : format;
  if (["cookie-brother", "json", "storage-state", "har", "chrome-sqlite"].includes(kind)) return parseJson(text, targetUrl);
  if (kind === "netscape") return parseNetscape(text);
  if (kind === "cookie-header") return parseHeader(text, targetUrl);
  if (kind === "set-cookie") return parseSetCookie(text, targetUrl);
  throw new Error("Format input tidak dikenali.");
}
