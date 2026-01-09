// js/common.js  (same-origin /api)
(() => {
  const state = { user: null };

  const $ = (sel) => document.querySelector(sel);

  async function api(path, options = {}) {
    const url = `/api${path.startsWith("/") ? path : `/${path}`}`;

    const res = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      let msg = `API ${res.status}`;
      try {
        const data = await res.json();
        if (data?.detail) msg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        else if (data?.message) msg = data.message;
      } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  // ===== Demo login =====
  function getUser() {
    try { return JSON.parse(localStorage.getItem("demo_user") || "null"); }
    catch { return null; }
  }
  function setUser(u) {
    state.user = u;
    if (!u) localStorage.removeItem("demo_user");
    else localStorage.setItem("demo_user", JSON.stringify(u));
    renderAccount();
  }

  function openModal(sel) {
    const el = $(sel);
    if (!el) return;
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
  }
  function closeModal(sel) {
    const el = $(sel);
    if (!el) return;
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
  }

  function renderAccount() {
    const badge = $("#userBadge");
    const name = $("#userName");
    const btnLogin = $("#btnLogin");
    const btnLogout = $("#btnLogout");

    const u = state.user;

    if (u) {
      if (badge) badge.hidden = false;
      if (name) name.textContent = u.name || "User";
      if (btnLogin) btnLogin.hidden = true;
      if (btnLogout) btnLogout.hidden = false;
    } else {
      if (badge) badge.hidden = true;  // ✅ 未登入不要顯示 User
      if (btnLogin) btnLogin.hidden = false;
      if (btnLogout) btnLogout.hidden = true;
    }
  }

  function bindLoginUI() {
    const btnLogin = $("#btnLogin");
    const btnLogout = $("#btnLogout");
    const modal = $("#loginModal");

    if (btnLogin) btnLogin.addEventListener("click", () => openModal("#loginModal"));
    if (btnLogout) btnLogout.addEventListener("click", () => setUser(null));

    if (modal) {
      modal.addEventListener("click", (e) => {
        const t = e.target;
        if (t && t.dataset && t.dataset.close) closeModal("#loginModal");
      });
    }

    const btnDoLogin = $("#btnDoLogin");
    if (btnDoLogin) {
      btnDoLogin.addEventListener("click", () => {
        const loginName = $("#loginName")?.value?.trim();
        if (!loginName) {
          alert("請輸入顯示名稱");
          return;
        }
        setUser({ name: loginName });
        closeModal("#loginModal");
      });
    }
  }

  // expose
  window.api = api;
  window.auth = { getUser: () => state.user };

  // init
  state.user = getUser();
  renderAccount();
  bindLoginUI();
})();
