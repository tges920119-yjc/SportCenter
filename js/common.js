// ================================
// Common Auth (Cookie Session)
// ================================

const Auth = {
  user: null,
  mode: "login", // "login" | "register"

  async request(path, options = {}) {
    const opts = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      // Cookie Session 一定要帶 credentials
      credentials: "include"
    };

    const res = await fetch(path, opts);
    // 嘗試解析 JSON；如果不是 JSON 就讀 text
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json() : await res.text();

    if (!res.ok) {
      const msg = (body && body.detail) ? body.detail : (typeof body === "string" ? body : "Request failed");
      throw new Error(msg);
    }
    return body;
  },

  setMode(mode) {
    this.mode = mode;
    const btnLogin = document.getElementById("btnDoLogin");
    const btnReg = document.getElementById("btnDoRegister");
    const email = document.getElementById("registerEmail");
    const toggle = document.getElementById("toggleAuthMode");

    if (!btnLogin || !btnReg || !toggle) return;

    if (mode === "login") {
      btnLogin.hidden = false;
      btnReg.hidden = true;
      if (email) email.closest("div") ? (email.closest("div").hidden = true) : (email.hidden = true);
      toggle.textContent = "切換到註冊";
    } else {
      btnLogin.hidden = true;
      btnReg.hidden = false;
      if (email) email.closest("div") ? (email.closest("div").hidden = false) : (email.hidden = false);
      toggle.textContent = "切換到登入";
    }
  },

  openModal() {
    const modal = document.getElementById("loginModal");
    if (!modal) return;
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
  },

  closeModal() {
    const modal = document.getElementById("loginModal");
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
  },

  setHeaderUI() {
    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");

    // 你如果有顯示使用者名字的元素（例如 #navUserName）
    const navUserName = document.getElementById("navUserName");

    if (this.user) {
      if (btnLogin) btnLogin.hidden = true;
      if (btnLogout) btnLogout.hidden = false;
      if (navUserName) navUserName.textContent = this.user.display_name;
    } else {
      if (btnLogin) btnLogin.hidden = false;
      if (btnLogout) btnLogout.hidden = true;
      if (navUserName) navUserName.textContent = "";
    }
  },

  async refreshMe() {
    try {
      const me = await this.request("/api/auth/me", { method: "GET" });
      this.user = me;
    } catch (e) {
      this.user = null;
    }
    this.setHeaderUI();
    return this.user;
  },

  async login(display_name, password) {
    const payload = { display_name, password };
    await this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await this.refreshMe();
  },

  async register(display_name, password, email) {
    const payload = { display_name, password };
    if (email) payload.email = email;

    await this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await this.refreshMe();
  },

  async logout() {
    await this.request("/api/auth/logout", { method: "POST", body: "{}" });
    this.user = null;
    this.setHeaderUI();
  }
};

// ================================
// Wire up DOM events
// ================================
document.addEventListener("DOMContentLoaded", async () => {
  // 預設登入模式
  Auth.setMode("login");

  // 初始化登入狀態（會用 cookie 去 /me）
  await Auth.refreshMe();

  // Header buttons
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");

  if (btnLogin) btnLogin.addEventListener("click", (e) => {
    e.preventDefault();
    Auth.openModal();
  });

  if (btnLogout) btnLogout.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await Auth.logout();
      alert("已登出");
    } catch (err) {
      alert(err.message || "登出失敗");
    }
  });

  // Modal actions
  const btnDoLogin = document.getElementById("btnDoLogin");
  const btnDoRegister = document.getElementById("btnDoRegister");
  const toggleAuthMode = document.getElementById("toggleAuthMode");

  const loginName = document.getElementById("loginName");
  const loginPassword = document.getElementById("loginPassword");
  const registerEmail = document.getElementById("registerEmail");

  if (toggleAuthMode) toggleAuthMode.addEventListener("click", (e) => {
    e.preventDefault();
    Auth.setMode(Auth.mode === "login" ? "register" : "login");
  });

  if (btnDoLogin) btnDoLogin.addEventListener("click", async () => {
    try {
      const dn = (loginName?.value || "").trim();
      const pw = (loginPassword?.value || "").trim();
      if (!dn || !pw) return alert("請輸入帳號與密碼");

      await Auth.login(dn, pw);
      Auth.closeModal();
      alert("登入成功");
      // 觸發自訂事件，讓 booking.js 可以知道已登入
      window.dispatchEvent(new CustomEvent("auth:changed", { detail: { user: Auth.user } }));
    } catch (err) {
      alert(err.message || "登入失敗");
    }
  });

  if (btnDoRegister) btnDoRegister.addEventListener("click", async () => {
    try {
      const dn = (loginName?.value || "").trim();
      const pw = (loginPassword?.value || "").trim();
      const em = (registerEmail?.value || "").trim();
      if (!dn || !pw) return alert("請輸入帳號與密碼");

      await Auth.register(dn, pw, em);
      Auth.closeModal();
      alert("註冊成功（已自動登入）");
      window.dispatchEvent(new CustomEvent("auth:changed", { detail: { user: Auth.user } }));
    } catch (err) {
      alert(err.message || "註冊失敗");
    }
  });

  // 讓其他 js 使用
  window.Auth = Auth;
});
