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

// ===== force bind login modal (failsafe) =====
(function () {
  function $(id) { return document.getElementById(id); }

  function openLoginModal() {
    const modal = $("loginModal");
    if (!modal) {
      console.error("[common.js] loginModal not found");
      alert("loginModal 不存在：請確認 index.html / my.html 有 <div id='loginModal' class='modal'> ...");
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

  document.addEventListener("DOMContentLoaded", () => {
    const btnLogin = $("btnLogin");
    const btnLogout = $("btnLogout");
    const modal = $("loginModal");

    if (!btnLogin) console.error("[common.js] btnLogin not found");
    if (!modal) console.error("[common.js] loginModal not found");

    btnLogin?.addEventListener("click", openLoginModal);

    // 點遮罩 / 叉叉關閉
    if (modal) {
      modal.addEventListener("click", (e) => {
        const t = e.target;
        if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeLoginModal();
      });
      modal.querySelector(".modal__panel")?.addEventListener("click", (e) => e.stopPropagation());
    }

    // 登出只是先關閉 modal（避免卡住），實際登出你原本 common.js 應該有做
    btnLogout?.addEventListener("click", closeLoginModal);
  });

  // 讓 booking.js 也能叫
  window.openLoginModal = openLoginModal;
  window.closeLoginModal = closeLoginModal;
})();
