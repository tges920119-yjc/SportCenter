// js/common.js  (same-origin /api)
(() => {
  const state = {
    user: null,
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  // ===============================
  // 統一 API 呼叫（同源 /api）
  // ===============================
  async function api(path, options = {}) {
    const url = path.startsWith("/api")
      ? path
      : `/api${path.startsWith("/") ? path : `/${path}`}`;

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
        if (data?.detail)
          msg = typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail);
        else if (data?.message) msg = data.message;
      } catch {}
      throw new Error(msg);
    }

    // 204 No Content
    if (res.status === 204) return null;
    return res.json();
  }

  // ===============================
  // Demo login（前端示範）
  // ===============================
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem("demo_user") || "null");
    } catch {
      return null;
    }
  }

  function setUser(u) {
    state.user = u;
    if (u) localStorage.setItem("demo_user", JSON.stringify(u));
    else localStorage.removeItem("demo_user");
    renderAccount();
  }

  function clearUser() {
    setUser(null);
  }

  function openModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
  }

  function closeModal(id) {
    const el = $(id);
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
      if (badge) badge.hidden = true;
      if (btnLogin) btnLogin.hidden = false;
      if (btnLogout) btnLogout.hidden = true;
    }
  }

  function bindLoginUI() {
    const btnLogin = $("#btnLogin");
    const btnLogout = $("#btnLogout");
    const modal = $("#loginModal");

    if (btnLogin)
      btnLogin.addEventListener("click", () => openModal("#loginModal"));
    if (btnLogout)
      btnLogout.addEventListener("click", () => clearUser());

    if (modal) {
      modal.addEventListener("click", (e) => {
        const t = e.target;
        if (t && t.dataset && t.dataset.close)
          closeModal("#loginModal");
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

  // ===============================
  // 對外提供
  // ===============================
  window.api = api;
  window.auth = {
    getUser: () => state.user,
  };

  // init
  state.user = getUser();
  renderAccount();
  bindLoginUI();
})();
