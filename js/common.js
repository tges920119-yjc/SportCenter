/* js/common.js */
(() => {
  "use strict";

  // ===== Config =====
  window.API_BASE = window.API_BASE || ""; // 空字串 = 同網域相對路徑（建議）

  const TOKEN_KEY = "sportcenter_token";
  const USER_KEY  = "sportcenter_user";

  const ENDPOINTS = {
    ME: "/api/auth/me",
    LOGIN: "/api/auth/login_token",
    REGISTER: "/api/auth/register",
  };

  // ===== Date helper (local) =====
  window.todayLocalYYYYMMDD = function todayLocalYYYYMMDD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // ===== Token helpers =====
  window.getToken = function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
  };
  window.setToken = function setToken(v) {
    try {
      if (!v) localStorage.removeItem(TOKEN_KEY);
      else localStorage.setItem(TOKEN_KEY, v);
    } catch {}
  };

  // ===== User helpers =====
  function readUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
    catch { return null; }
  }
  function writeUser(me) {
    try {
      if (!me) localStorage.removeItem(USER_KEY);
      else localStorage.setItem(USER_KEY, JSON.stringify(me));
    } catch {}
  }

  window.setUser = function setUser(me) {
    window.__ME__ = me || null;
    writeUser(window.__ME__);

    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");
    const navUserName = document.getElementById("navUserName");

    if (window.__ME__) {
      if (btnLogin) btnLogin.hidden = true;
      if (btnLogout) btnLogout.hidden = false;
      if (navUserName) navUserName.textContent = window.__ME__.display_name || "";
    } else {
      if (btnLogin) btnLogin.hidden = false;
      if (btnLogout) btnLogout.hidden = true;
      if (navUserName) navUserName.textContent = "";
    }
  };

  // ===== API wrapper =====
  window.api = async function api(path, opts = {}) {
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    const token = window.getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    const base = window.API_BASE || "";
    const url = base + path;

    const res = await fetch(url, { ...opts, headers });
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json() : await res.text();

    if (!res.ok) {
      const msg = body?.detail || (typeof body === "string" ? body : "Request failed");
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  };

  // ===== refreshMe：只在 401/403 才清 token =====
  window.refreshMe = async function refreshMe() {
    const token = window.getToken();
    if (!token) { window.setUser(null); return null; }

    try {
      const me = await window.api(ENDPOINTS.ME, { method: "GET" });
      window.setUser(me);
      return me;
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        window.setToken("");
        window.setUser(null);
      }
      return null;
    }
  };

  // ===== Modal Auth UI =====
  const $ = (id) => document.getElementById(id);

  const modal = () => $("loginModal");
  const panel = () => modal()?.querySelector(".modal__panel");

  let authMode = "login"; // login | register

  function openModal() {
    const m = modal();
    if (!m) return;
    m.setAttribute("aria-hidden", "false");
    m.classList.add("is-open");
  }
  function closeModal() {
    const m = modal();
    if (!m) return;
    m.setAttribute("aria-hidden", "true");
    m.classList.remove("is-open");
  }

  function setAuthMode(mode) {
    authMode = mode;

    const title = $("authTitle");
    const btnLogin = $("btnDoLogin");
    const btnReg = $("btnDoRegister");
    const toggle = $("toggleAuthMode");
    const emailWrap = $("registerEmailWrap");

    if (mode === "login") {
      if (title) title.textContent = "登入";
      if (btnLogin) btnLogin.hidden = false;
      if (btnReg) btnReg.hidden = true;
      if (emailWrap) emailWrap.style.display = "none";
      if (toggle) toggle.textContent = "切換到註冊";
    } else {
      if (title) title.textContent = "註冊";
      if (btnLogin) btnLogin.hidden = true;
      if (btnReg) btnReg.hidden = false;
      if (emailWrap) emailWrap.style.display = "block";
      if (toggle) toggle.textContent = "切換到登入";
    }
  }

  function errText(err, fallback) {
    if (!err) return fallback || "發生錯誤";
    if (typeof err === "string") return err;
    return err.message || fallback || "發生錯誤";
  }

  async function doLogin() {
    const dn = ($("loginName")?.value || "").trim();
    const pw = ($("loginPass")?.value || "").trim();
    if (!dn || !pw) { alert("請輸入帳號與密碼"); return; }

    const r = await window.api(ENDPOINTS.LOGIN, {
      method: "POST",
      body: JSON.stringify({ display_name: dn, password: pw })
    });

    const token = r?.token || r?.access_token || "";
    if (!token) { alert("登入失敗：未取得 token"); return; }

    window.setToken(token);
    await window.refreshMe();
    closeModal();
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: { user: window.__ME__ } }));
    alert("登入成功");
  }

  async function doRegister() {
    const dn = ($("loginName")?.value || "").trim();
    const pw = ($("loginPass")?.value || "").trim();
    const em = ($("registerEmail")?.value || "").trim();

    if (!dn || !pw) { alert("請輸入帳號與密碼"); return; }

    // ✅ email 有填才送
    const payload = { display_name: dn, password: pw };
    if (em) payload.email = em;

    await window.api(ENDPOINTS.REGISTER, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    // 註冊成功直接登入
    await doLogin();
  }

  function bindModal() {
    const m = modal();
    if (!m) return;

    // 只點 backdrop / close 才關
    m.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeModal();
    });

    // 面板 stopPropagation（避免點任何地方都關）
    panel()?.addEventListener("click", (e) => e.stopPropagation());

    // ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    $("toggleAuthMode")?.addEventListener("click", (e) => {
      e.preventDefault();
      setAuthMode(authMode === "login" ? "register" : "login");
    });

    $("btnDoLogin")?.addEventListener("click", async () => {
      try { await doLogin(); }
      catch (err) { alert(errText(err, "登入失敗")); }
    });

    $("btnDoRegister")?.addEventListener("click", async () => {
      try { await doRegister(); }
      catch (err) { alert(errText(err, "註冊失敗")); }
    });
  }

  function bindHeader() {
    $("btnLogin")?.addEventListener("click", () => {
      setAuthMode("login"); // ✅ 每次開都回到登入
      openModal();
    });

    $("btnLogout")?.addEventListener("click", () => {
      window.setToken("");
      window.setUser(null);
      window.dispatchEvent(new CustomEvent("auth:changed", { detail: { user: null } }));
      alert("已登出");
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    window.setUser(readUser());
    bindModal();
    bindHeader();
    setAuthMode("login");
    await window.refreshMe();
    console.log("common.js loaded OK", new Date().toISOString());
  });
})();
