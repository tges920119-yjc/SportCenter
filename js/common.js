/* js/common.js
 * Purpose:
 * - Provide shared helpers (API_BASE, token/user storage, api wrapper, date helper)
 * - DO NOT bind login/register/logout/modal events here (avoid double-binding)
 */

(function () {
  // ====== CONFIG ======
  // 若你 index.html 內有定義 API_BASE，就沿用；否則用目前網域
  if (!window.API_BASE) {
    // 你的後端路由是 /api/...
    window.API_BASE = ""; // same origin (booking.novrise.org)
  }

  const TOKEN_KEY = "sportcenter_token";
  const USER_KEY = "sportcenter_user";

  // ====== Storage helpers ======
  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(token) {
    const t = (token || "").trim();
    if (!t) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, t);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setUser(user) {
    if (!user) localStorage.removeItem(USER_KEY);
    else localStorage.setItem(USER_KEY, JSON.stringify(user));
    // 同步 header UI（如果頁面有這些元素）
    refreshHeaderUI(user);
  }

  function refreshHeaderUI(user = null) {
    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");
    const navUserName = document.getElementById("navUserName");
    const u = user ?? getUser();

    if (u) {
      if (btnLogin) btnLogin.hidden = true;
      if (btnLogout) btnLogout.hidden = false;
      if (navUserName) navUserName.textContent = u.display_name || "";
    } else {
      if (btnLogin) btnLogin.hidden = false;
      if (btnLogout) btnLogout.hidden = true;
      if (navUserName) navUserName.textContent = "";
    }
  }

  // ====== Date helper (avoid UTC offset issue) ======
  function todayLocalYYYYMMDD() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // ====== API wrapper ======
  async function api(path, opts = {}) {
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    const res = await fetch(window.API_BASE + path, { ...opts, headers });

    const ct = res.headers.get("content-type") || "";
    let body = null;

    try {
      body = ct.includes("application/json") ? await res.json() : await res.text();
    } catch {
      body = null;
    }

    if (!res.ok) {
      // 讓錯誤訊息不要變成 [object Object]
      let msg = "Request failed";
      if (typeof body === "string" && body.trim()) msg = body;
      else if (body && typeof body === "object") {
        msg = body.detail || body.message || JSON.stringify(body);
      }
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  // ====== Refresh /me (for booking.js or others) ======
  async function refreshMe() {
    const token = getToken();
    if (!token) {
      setUser(null);
      return null;
    }
    try {
      const me = await api("/api/auth/me", { method: "GET" });
      setUser(me);
      return me;
    } catch {
      setToken("");
      setUser(null);
      return null;
    }
  }

  // expose globals used by booking.js
  window.getToken = getToken;
  window.setToken = setToken;
  window.getUser = getUser;
  window.setUser = setUser;
  window.api = api;
  window.refreshMe = refreshMe;
  window.todayLocalYYYYMMDD = todayLocalYYYYMMDD;
  window.refreshHeaderUI = refreshHeaderUI;

  console.log("common.js loaded OK", new Date().toISOString());

  // 初始同步一次 header（避免刷新後 header 沒更新）
  document.addEventListener("DOMContentLoaded", () => {
    refreshHeaderUI(getUser());
  });
})();
