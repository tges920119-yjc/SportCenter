/* js/common.js
 * 職責：
 * - 管理 token / user（localStorage）
 * - 提供 window.api / getToken / setToken / setUser / refreshMe
 * - 管理登入/註冊 modal（切換、開關、按鈕事件）
 */

(() => {
  "use strict";

  // =========================
  // Config
  // =========================
  // ✅ 不要用 const API_BASE，避免重複宣告炸掉
  // 留空表示同網域相對路徑（建議）
  window.API_BASE = window.API_BASE || "";

  // 你原本 index.html inline 用的是 sportcenter_token / sportcenter_user
  const TOKEN_KEY = "sportcenter_token";
  const USER_KEY  = "sportcenter_user";

  const ENDPOINTS = {
    ME: "/api/auth/me",
    LOGIN: "/api/auth/login_token",
    REGISTER: "/api/auth/register",
  };

  // =========================
  // Date helper (local)
  // =========================
  window.todayLocalYYYYMMDD = function todayLocalYYYYMMDD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // =========================
  // Token helpers
  // =========================
  window.getToken = function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
  };

  window.setToken = function setToken(v) {
    try {
      if (!v) localStorage.removeItem(TOKEN_KEY);
      else localStorage.setItem(TOKEN_KEY, v);
    } catch {}
  };

  // =========================
  // User helpers
  // =========================
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

    // header UI
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

  // =========================
  // API wrapper
  // =========================
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
      throw err;
    }
    return body;
  };

  // =========================
  // refreshMe：只有 401/403 才清 token（避免暫時錯誤把你登出）
  // =========================
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

  // =========================
  // Modal auth UI
  // =========================
  const modal = () => document.getElementById("loginModal");
  const panel = () => modal()?.querySelector(".modal__panel");
  const titleEl = () => document.getElementById("authTitle");
  const emailWrap = () => document.getElementById("registerEmailWrap");

  const btnDoLogin = () => document.getElementById("btnDoLogin");
  const btnDoRegister = () => document.getElementById("btnDoRegister");
  const toggleAuthMode = () => document.getElementById("toggleAuthMode");

  const loginName = () => document.getElementById("loginName");
  const loginPass = () => document.getElementById("loginPass");
  const registerEmail = () => document.getElementById("registerEmail");

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

    const bLogin = btnDoLogin();
    const bReg = btnDoRegister();
    const tgl = toggleAuthMode();
    const ew = emailWrap();
    const tt = titleEl();

    if (mode === "login") {
      if (tt) tt.textContent = "登入";
      if (bLogin) bLogin.hidden = false;
      if (bReg) bReg.hidden = true;
      if (ew) ew.style.display = "none";
      if (tgl) tgl.textContent = "切換到註冊";
    } else {
      if (tt) tt.textContent = "註冊";
      if (bLogin) bLogin.hidden = true;
      if (bReg) bReg.hidden = false;
      if (ew) ew.style.display = "block";
      if (tgl) tgl.textContent = "切換到登入";
    }
  }

  async function doLogin() {
    const dn = (loginName()?.value || "").trim();
    const pw = (loginPass()?.value || "").trim();
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
    const dn = (loginName()?.value || "").trim();
    const pw = (loginPass()?.value || "").trim();
    const em = (registerEmail()?.value || "").trim();

    if (!dn || !pw) { alert("請輸入帳號與密碼"); return; }

    // ✅ email 有填才送，避免填 'ggg' 直接 400
    const payload = { display_name: dn, password: pw };
    if (em) payload.email = em;

    await window.api(ENDPOINTS.REGISTER, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    // 註冊成功後直接登入
    await doLogin();
  }

  function bindModalClose() {
    const m = modal();
    if (!m) return;

    // 只點遮罩/close 按鈕關閉
    m.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeModal();
    });

    // 面板不要冒泡到遮罩（避免點任何地方都關）
    panel()?.addEventListener("click", (e) => e.stopPropagation());

    // Esc 關閉
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  function bindHeaderButtons() {
    document.getElementById("btnLogin")?.addEventListener("click", () => {
      setAuthMode("login"); // ✅ 每次開都是登入，避免你說的「又跳到註冊」
      openModal();
    });

    document.getElementById("btnLogout")?.addEventListener("click", () => {
      window.setToken("");
      window.setUser(null);
      alert("已登出");
      window.dispatchEvent(new CustomEvent("auth:changed", { detail: { user: null } }));
    });
  }

  function bindAuthButtons() {
    toggleAuthMode()?.addEventListener("click", (e) => {
      e.preventDefault();
      setAuthMode(authMode === "login" ? "register" : "login");
    });

    btnDoLogin()?.addEventListener("click", async () => {
      try { await doLogin(); }
      catch (err) { alert(err?.message || "登入失敗"); }
    });

    btnDoRegister()?.addEventListener("click", async () => {
      try { await doRegister(); }
      catch (err) { alert(err?.message || "註冊失敗"); }
    });
  }

  // =========================
  // Boot
  // =========================
  document.addEventListener("DOMContentLoaded", async () => {
    // 先還原 user（如果有）
    window.setUser(readUser());

    bindModalClose();
    bindHeaderButtons();
    bindAuthButtons();

    // 刷新 me（若 token 還有效）
    await window.refreshMe();

    console.log("common.js loaded OK", new Date().toISOString());
  });
})();
