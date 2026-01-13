// js/common.js
(function () {
  console.log("common.js loaded OK");

  window.API_BASE = window.API_BASE || "https://booking.novrise.org/api";

  function getToken() {
    return localStorage.getItem("token") || "";
  }
  function setToken(t) {
    if (!t) localStorage.removeItem("token");
    else localStorage.setItem("token", t);
  }

  function todayLocalYYYYMMDD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  async function api(path, opts = {}) {
    const url = `${window.API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

    const headers = Object.assign(
      { "Content-Type": "application/json" },
      opts.headers || {}
    );

    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, Object.assign({}, opts, { headers }));

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

  async function refreshMe() {
    const t = getToken();
    const meName = document.getElementById("meName");
    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");

    if (meName) meName.textContent = t ? t : "";
    if (btnLogin) btnLogin.hidden = !!t;
    if (btnLogout) btnLogout.hidden = !t;
  }

  window.getToken = getToken;
  window.setToken = setToken;
  window.api = api;
  window.todayLocalYYYYMMDD = todayLocalYYYYMMDD;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.refreshMe = refreshMe;
})();
