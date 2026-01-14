(() => {
  "use strict";

  console.log("[common.js] loaded OK");

  // =========================
  // Config & helpers
  // =========================
  const $ = (id) => document.getElementById(id);

  // 如果你有在別處設定 window.API_BASE，就會優先用你的
  // 沒有的話就用同網域（例如 booking.novrise.org）
  if (!window.API_BASE) window.API_BASE = "";

  function todayLocalYYYYMMDD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  window.todayLocalYYYYMMDD = todayLocalYYYYMMDD;

  function getToken() {
    return localStorage.getItem("token") || "";
  }
  function setToken(t) {
    if (!t) localStorage.removeItem("token");
    else localStorage.setItem("token", t);
  }
  function setUser(u) {
    if (!u) localStorage.removeItem("user");
    else localStorage.setItem("user", JSON.stringify(u));
  }
  function getUser() {
    try {
      const s = localStorage.getItem("user");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  window.getToken = getToken;
  window.setToken = setToken;
  window.setUser = setUser;

  // 統一 API 呼叫：自動帶 Authorization
  async function api(path, options = {}) {
    const url = (window.API_BASE || "") + path;
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      options.headers || {}
    );

    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const resp = await fetch(url, { ...options, headers });

    // 嘗試解析 JSON / 文字
    const ctype = resp.headers.get("content-type") || "";
    let data = null;
    if (ctype.includes("application/json")) {
      try { data = await resp.json(); } catch { data = null; }
    } else {
      try { data = await resp.text(); } catch { data = null; }
    }

    if (!resp.ok) {
      // FastAPI 常見錯誤格式 {"detail":"..."}
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

  function setNavLoginUI(isLoggedIn, nameText = "") {
    const meName = $("meName") || $("navUserName");
    const btnLogin = $("btnLogin");
    const btnLogout = $("btnLogout");

    if (meName) meName.textContent = isLoggedIn ? (nameText || "") : "";
    if (btnLogin) btnLogin.hidden = !!isLoggedIn;
    if (btnLogout) btnLogout.hidden = !isLoggedIn;
  }

  // refreshMe：抓 /api/me（如果你後端不是這個也不會炸）
  async function refreshMe() {
    const token = getToken();
    if (!token) {
      setNavLoginUI(false, "");
      return null;
    }
    try {
      // 你後端若不是 /api/me，這裡會 catch，UI 仍可用
      const me = await api("/api/me", { method: "GET" });
      setUser(me);
      const display =
        me?.display_name ||
        me?.username ||
        me?.name ||
        me?.email ||
        "";
      setNavLoginUI(true, display);
      return me;
    } catch (e) {
      console.warn("[common.js] refreshMe failed:", e?.message || e);
      // token 失效就清掉
      setToken("");
      setUser(null);
      setNavLoginUI(false, "");
      return null;
    }
  }
  window.refreshMe = refreshMe;

  // =========================
  // Modal controls
  // =========================
  function openLoginModal() {
    const modal = $("loginModal");
    if (!modal) {
      alert("找不到 loginModal（請確認 HTML 有 <div id='loginModal' ...> ）");
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

    // 若你的頁面沒有 tab（只有登入），就跳過，不要報錯
    if (!tabLogin || !tabReg || !panelLogin || !panelReg) return;

    const isLogin = which === "login";
    tabLogin.classList.toggle("is-active", isLogin);
    tabReg.classList.toggle("is-active", !isLogin);
    panelLogin.hidden = !isLogin;
    panelReg.hidden = isLogin;

    const lm = $("loginMsg"); if (lm) lm.textContent = "";
    const rm = $("regMsg"); if (rm) rm.textContent = "";
  }

  // =========================
  // Auth actions (with safe fallbacks)
  // =========================
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
      // ✅ 你後端若不是這個路徑，會顯示錯誤訊息，但按鈕仍有反應
      const r = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: name, password: pass })
      });

      const token = r?.token || r?.access_token || "";
      if (token) setToken(token);

      // 嘗試 refreshMe 更新右上角
      await refreshMe();

      if (msg) msg.textContent = "登入成功";
      closeLoginModal();
    } catch (e) {
      console.error(e);
      if (msg) msg.textContent = e?.message || "登入失敗（請確認後端登入 API 路徑）";
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
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ display_name: display, username: name, password: pass })
      });

      if (msg) msg.textContent = "註冊成功，請登入";
      setTab("login");

      // 幫你把帳密帶回登入（方便測）
      const ln = $("loginName"); if (ln) ln.value = name;
      const lp = $("loginPass"); if (lp) lp.value = pass;
    } catch (e) {
      console.error(e);
      if (msg) msg.textContent = e?.message || "註冊失敗（請確認後端註冊 API 路徑）";
    }
  }

  // =========================
  // Wire up DOM events
  // =========================
  document.addEventListener("DOMContentLoaded", async () => {
    // UI init
    const u = getUser();
    if (getToken()) {
      setNavLoginUI(true, u?.display_name || u?.username || "");
    } else {
      setNavLoginUI(false, "");
    }

    // Login open
    $("btnLogin")?.addEventListener("click", openLoginModal);

    // Logout
    $("btnLogout")?.addEventListener("click", async () => {
      setToken("");
      setUser(null);
      setNavLoginUI(false, "");
      closeLoginModal();
    });

    // Modal close behaviors
    const modal = $("loginModal");
    if (modal) {
      // 點遮罩 or X 關閉（都用 data-close="1"）
      modal.addEventListener("click", (e) => {
        const t = e.target;
        if (t && t.getAttribute && t.getAttribute("data-close") === "1") {
          closeLoginModal();
        }
      });
      // 點 panel 不要冒泡關閉
      modal.querySelector(".modal__panel")?.addEventListener("click", (e) => e.stopPropagation());
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLoginModal();
    });

    // Tabs (if exist)
    $("tabLogin")?.addEventListener("click", () => setTab("login"));
    $("tabRegister")?.addEventListener("click", () => setTab("register"));

    // Buttons
    $("btnDoLogin")?.addEventListener("click", doLogin);
    $("btnDoRegister")?.addEventListener("click", doRegister);

    // Default tab
    setTab("login");

    // Try refreshMe (won't break if API not ready)
    await refreshMe();
  });
})();
