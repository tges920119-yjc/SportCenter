// ~/web/js/common.js
(function () {
  console.log("common.js loaded OK");

  // API_ORIGIN 不要含 /api
  window.API_ORIGIN = window.API_ORIGIN || "https://booking.novrise.org";

  function getToken() {
    return localStorage.getItem("token") || "";
  }
  function setToken(t) {
    if (!t) localStorage.removeItem("token");
    else localStorage.setItem("token", t);
    window.dispatchEvent(new Event("auth:changed"));
  }

  // 可讓別的頁面存 user 資訊（不強制依賴）
  let _user = null;
  function setUser(u) {
    _user = u || null;
  }
  function getUser() {
    return _user;
  }

  function todayLocalYYYYMMDD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  async function api(path, opts = {}) {
    let url = path;

    // full url
    if (!/^https?:\/\//i.test(url)) {
      // normalize: ensure starts with /api
      if (!url.startsWith("/")) url = "/" + url;
      if (!url.startsWith("/api/")) url = "/api" + url;
      url = window.API_ORIGIN + url;
    }

    const headers = Object.assign(
      { "Content-Type": "application/json" },
      opts.headers || {}
    );

    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, Object.assign({}, opts, { headers, credentials: "include" }));

    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const data = await res.json();
        if (data && data.detail) msg = data.detail;
      } catch (e) {
        try {
          const text = await res.text();
          if (text) msg = text;
        } catch (_) {}
      }
      throw new Error(msg);
    }

    if (res.status === 204) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    return await res.text();
  }

  // 讓舊程式可用（你之前 refreshMe 掛在 window）
  async function refreshMe() {
    const navUserName = document.getElementById("navUserName") || document.getElementById("meName");
    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");

    const token = getToken();
    if (!token) {
      setUser(null);
      if (navUserName) navUserName.textContent = "";
      if (btnLogin) btnLogin.hidden = false;
      if (btnLogout) btnLogout.hidden = true;
      return null;
    }

    try {
      const me = await api("/api/auth/me", { method: "GET" });
      setUser(me);

      if (navUserName) navUserName.textContent = me.display_name || "";
      if (btnLogin) btnLogin.hidden = true;
      if (btnLogout) btnLogout.hidden = false;

      return me;
    } catch (e) {
      // token 失效就清掉
      setToken("");
      setUser(null);
      if (navUserName) navUserName.textContent = "";
      if (btnLogin) btnLogin.hidden = false;
      if (btnLogout) btnLogout.hidden = true;
      return null;
    }
  }

  // modal（如果你原本有用）
  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
  }

  window.api = api;
  window.getToken = getToken;
  window.setToken = setToken;
  window.setUser = setUser;
  window.getUser = getUser;
  window.refreshMe = refreshMe;
  window.todayLocalYYYYMMDD = todayLocalYYYYMMDD;
  window.openModal = openModal;
  window.closeModal = closeModal;
})();

// ===== Login/Register modal binding (final) =====
(function () {
  const $ = (id) => document.getElementById(id);

  function openModal() {
    const modal = $("loginModal");
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    const modal = $("loginModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function setTab(which) {
    const tabLogin = $("tabLogin");
    const tabReg = $("tabRegister");
    const panelLogin = $("panelLogin");
    const panelReg = $("panelRegister");
    if (!tabLogin || !tabReg || !panelLogin || !panelReg) return;

    const isLogin = which === "login";
    tabLogin.classList.toggle("is-active", isLogin);
    tabReg.classList.toggle("is-active", !isLogin);
    panelLogin.hidden = !isLogin;
    panelReg.hidden = isLogin;

    // 清訊息
    const lm = $("loginMsg"); if (lm) lm.textContent = "";
    const rm = $("regMsg"); if (rm) rm.textContent = "";
  }

  async function doLogin() {
    const name = ($("loginName")?.value || "").trim();
    const pass = ($("loginPass")?.value || "").trim();
    const msg = $("loginMsg");
    if (msg) msg.textContent = "";

    if (!name || !pass) {
      if (msg) msg.textContent = "請輸入帳號與密碼";
      return;
    }

    try {
      // 依你後端實作調整：這裡假設 POST /api/auth/login
      const r = await window.api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: name, password: pass })
      });

      // r.token / r.user 視你後端回傳
      if (r?.token && typeof window.setToken === "function") window.setToken(r.token);
      if (r?.user && typeof window.setUser === "function") window.setUser(r.user);

      if (typeof window.refreshMe === "function") await window.refreshMe();
      closeModal();
    } catch (e) {
      console.error(e);
      if (msg) msg.textContent = e?.message || "登入失敗";
    }
  }

  async function doRegister() {
    const display = ($("regDisplayName")?.value || "").trim();
    const name = ($("regName")?.value || "").trim();
    const pass = ($("regPass")?.value || "").trim();
    const msg = $("regMsg");
    if (msg) msg.textContent = "";

    if (!display || !name || !pass) {
      if (msg) msg.textContent = "請輸入顯示名稱、帳號、密碼";
      return;
    }

    try {
      // 依你後端實作調整：這裡假設 POST /api/auth/register
      await window.api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ display_name: display, username: name, password: pass })
      });

      if (msg) msg.textContent = "註冊成功，請登入";
      setTab("login");
      $("loginName").value = name;
      $("loginPass").value = pass;
    } catch (e) {
      console.error(e);
      if (msg) msg.textContent = e?.message || "註冊失敗";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // open
    $("btnLogin")?.addEventListener("click", openModal);

    // close: overlay / X / ESC
    const modal = $("loginModal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        const t = e.target;
        if (t?.getAttribute?.("data-close") === "1") closeModal();
      });
      modal.querySelector(".modal__panel")?.addEventListener("click", (e) => e.stopPropagation());
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    // tabs
    $("tabLogin")?.addEventListener("click", () => setTab("login"));
    $("tabRegister")?.addEventListener("click", () => setTab("register"));

    // actions
    $("btnDoLogin")?.addEventListener("click", doLogin);
    $("btnDoRegister")?.addEventListener("click", doRegister);

    // default tab
    setTab("login");
  });

  // 給其他頁面使用
  window.openLoginModal = openModal;
  window.closeLoginModal = closeModal;
})();

