/* js/common.js */

/**
 * ✅ 避免 "Identifier 'API_BASE' has already been declared"
 * 只使用 window.API_BASE，不用 const API_BASE 在全域宣告
 */
window.API_BASE = window.API_BASE || ""; // 可留空；若你要固定可填 "https://booking.novrise.org"

// ===== 日期：用本地時間，避免 toISOString() 的 UTC 偏差 =====
window.todayLocalYYYYMMDD = function todayLocalYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ===== Token helpers =====
window.getToken = function getToken() {
  try { return localStorage.getItem("token") || ""; } catch { return ""; }
};
window.setToken = function setToken(v) {
  try {
    if (!v) localStorage.removeItem("token");
    else localStorage.setItem("token", v);
  } catch {}
};

// ===== User state =====
window.setUser = function setUser(me) {
  window.__ME__ = me || null;

  // 可選：如果你有 btnLogin/btnLogout，可以在這裡同步顯示狀態
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogin && btnLogout) {
    if (window.__ME__) { btnLogin.hidden = true; btnLogout.hidden = false; }
    else { btnLogin.hidden = false; btnLogout.hidden = true; }
  }
};

// ===== API wrapper =====
window.api = async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const token = window.getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  // API_BASE 若留空，就用同網域相對路徑（建議）
  const base = window.API_BASE || "";
  const url = base + path;

  const res = await fetch(url, { ...opts, headers });
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = body?.detail || (typeof body === "string" ? body : "Request failed");
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
};

// ===== refreshMe：掛到 window，booking.js 才叫得到 =====
window.refreshMe = async function refreshMe() {
  const token = window.getToken();
  if (!token) { window.setUser(null); return null; }

  try {
    const me = await window.api("/api/auth/me", { method: "GET" });
    window.setUser(me);
    return me;
  } catch {
    window.setToken("");
    window.setUser(null);
    return null;
  }
};

console.log("common.js loaded OK", new Date().toISOString());
