(() => {
  "use strict";
  console.log("[common.js] loaded OK");

  const $ = (id) => document.getElementById(id);

  // 如果沒設定 API_BASE，就用同網域
  if (!window.API_BASE) window.API_BASE = "";

  function todayLocalYYYYMMDD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  window.todayLocalYYYYMMDD = todayLocalYYYYMMDD;

  // ===== token storage (optional) =====
  function getToken() {
    return localStorage.getItem("token") || "";
  }
  function setToken(t) {
    if (!t) localStorage.removeItem("token");
    else localStorage.setItem("token", t);
  }
  window.getToken = getToken;
  window.setToken = setToken;

  // ===== API helper (IMPORTANT: credentials include for cookie session) =====
  async function api(path, options = {}) {
    const url = (window.API_BASE || "") + path;

    const headers = Object.assign(
      { "Content-Type": "application/json" },
      options.headers || {}
    );

    // token login (optional)
    const token = getToken();
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    const resp = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body,
      credentials: "include", // ✅ 讓 cookie session 正常運作
    });

    const ctype = resp.headers.get("content-type") || "";
    let data = null;

    if (ctype.includes("application/json")) {
      try { data = await resp.json(); } catch { data = null; }
    } else {
      try { data = await resp.text(); } catch { data = null; }
    }

    if (!resp.ok) {
      const msg =
        (data && typeof data === "object" && (data.detail || data.message)) ||
        (typeof data === "string" && data) ||
        `${resp.status} ${path}`;
      const err = new Error(msg);
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  }
  window.api = api;

  // ===== UI helpers =====
  function setNavLoginUI(isLoggedIn, nameText = "") {
    const meName = $("meName") || $("navUserName");
    const btnLogin = $("btnLogin");
    const btnLogout = $("btnLogout");

    if (meName) meName.textContent = isLoggedIn ? (nameText || "") : "";
    if (btnLogin) btnLogin.hidden = !!isLoggedIn;
    if (btnLogout) btnLogout.hidden = !isLoggedIn;
  }

  // ===== Modal =====
  function openLoginModal() {
    const modal = $("loginModal");
    if (!modal) {
      alert("找不到 #loginModal，請確認 index.html 有登入 Modal");
      return;
    }
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeLoginModal() {
    const modal = $("loginModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  window.openLoginModal = openLoginModal;
  window.closeLoginModal = closeLoginModal;

  function setTab(which) {
    const tabLogin = $("tabLogin");
    const tabReg = $("tabRegister");
    const panelLogin = $("panelLogin");
    const panelReg = $("panelRegister");

    // 若頁面沒有做 tabs，就不處理
    if (!tabLogin || !tabReg || !panelLogin || !panelReg) return;

    const isLogin = which === "login";
    tabLogin.classList.toggle("is-active", isLogin);
    tabReg.classList.toggle("is-active", !isLogin);
    panelLogin.hidden = !isLogin;
    panelReg.hidden = isLogin;

    const lm = $("loginMsg"); if (lm) lm.textContent = "";
    const rm = $("regMsg"); if (rm) rm.textContent = "";
  }

  // ===== Auth =====
  async function refreshMe() {
    try {
      const me = await api("/api/auth/me", { method: "GET" });
      setNavLoginUI(true, me?.display_name || "");
      return me;
    } catch (e) {
      // 沒登入 / token 無效 / cookie 不在
      setNavLoginUI(false, "");
      return null;
    }
  }
  window.refreshMe = refreshMe;

  async function doLogin() {
    const msg = $("loginMsg");
    if (msg) msg.textContent = "";

    const display_name = ($("loginName")?.value || "").trim();
    const password = ($("loginPass")?.value || "").trim();

    if (!display_name || !password) {
      if (msg) msg.textContent = "請輸入帳號與密碼";
      return;
    }

    // ✅ 先用 token 登入（GitHub Pages / 跨網域更穩）
    try {
      if (msg) msg.textContent = "登入中…";
      const r = await api("/api/auth/login_token", {
        method: "POST",
        body: JSON.stringify({ display_name, password })
      });

      if (r?.token) setToken(r.token);

      await refreshMe();
      if (msg) msg.textContent = "登入成功";
      closeLoginModal();
      return;
    } catch (e1) {
      console.warn("[login_token failed] fallback to cookie login:", e1?.message);
    }

    // ✅ fallback：cookie session 登入
    try {
      if (msg) msg.textContent = "登入中…";
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ display_name, password })
      });

      // cookie 會由 server set-cookie；refreshMe 需要 credentials include 才會成功
      await refreshMe();
      if (msg) msg.textContent = "登入成功";
      closeLoginModal();
    } catch (e2) {
      console.error(e2);
      if (msg) msg.textContent = e2?.message || "登入失敗";
    }
  }

  async function doRegister() {
    const msg = $("regMsg");
    if (msg) msg.textContent = "";

    const display_name = ($("regName")?.value || "").trim(); // ✅ 對齊後端：display_name
    const password = ($("regPass")?.value || "").trim();
    const email = ($("regEmail")?.value || "").trim();
    const phone = ($("regPhone")?.value || "").trim();

    if (!display_name || !password) {
      if (msg) msg.textContent = "請輸入帳號與密碼（密碼至少 6 碼）";
      return;
    }

    try {
      if (msg) msg.textContent = "註冊中…";
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          display_name,
          password,
          email: email || null,
          phone: phone || null
        })
      });

      if (msg) msg.textContent = "註冊成功，請登入";
      setTab("login");

      const ln = $("loginName"); if (ln) ln.value = display_name;
      const lp = $("loginPass"); if (lp) lp.value = password;
    } catch (e) {
      console.error(e);
      if (msg) msg.textContent = e?.message || "註冊失敗";
    }
  }

  async function doLogout() {
    // 兩種都清掉
    setToken("");
    try { await api("/api/auth/logout", { method: "POST" }); } catch (_) {}
    setNavLoginUI(false, "");
    closeLoginModal();
  }

  // ===== Wire events =====
  document.addEventListener("DOMContentLoaded", async () => {
    // open modal
    $("btnLogin")?.addEventListener("click", openLoginModal);

    // logout
    $("btnLogout")?.addEventListener("click", doLogout);

    // ===== Modal close: overlay / X / ESC (hard bind) =====
    const modal = $("loginModal");
    const overlay = modal?.querySelector(".modal__overlay");
    const closeBtn = modal?.querySelector(".modal__close");

    // 點遮罩關閉
    overlay?.addEventListener("click", closeLoginModal);

    // 點 X 關閉（✅ 直接綁，不靠 data-close）
    closeBtn?.addEventListener("click", closeLoginModal);

    // 點 panel 內不要冒泡到 overlay
    modal?.querySelector(".modal__panel")?.addEventListener("click", (e) => e.stopPropagation());

    // ESC 關閉
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLoginModal();
    });

    // tabs
    $("tabLogin")?.addEventListener("click", () => setTab("login"));
    $("tabRegister")?.addEventListener("click", () => setTab("register"));

    // buttons
    $("btnDoLogin")?.addEventListener("click", doLogin);
    $("btnDoRegister")?.addEventListener("click", doRegister);

    // default tab
    setTab("login");

    // initial me
    await refreshMe();
  });
})();
