/* js/booking.js
 * 依賴：js/common.js 先載入（index.html 已確認 OK）
 * common.js 需要提供：
 *  - window.api(path, opts)
 *  - window.getToken(), window.setToken()
 *  - window.refreshMe()
 *  - window.setUser(me)
 *  - window.todayLocalYYYYMMDD()   (若沒有也會自動 fallback)
 */

(() => {
  "use strict";

  // =========================
  // Config：你若後端路由不同，只改這裡
  // =========================
  const ENDPOINTS = {
    ME: "/api/auth/me",
    LOGIN: "/api/auth/login",       // POST
    REGISTER: "/api/auth/register", // POST (可選)
    LOGOUT: "/api/auth/logout",     // POST (可選，不一定有)
    COURTS: "/api/courts",          // GET
    BOOKINGS: "/api/bookings",      // GET ?date=YYYY-MM-DD ; POST
    CANCEL: (bookingNo) => `/api/bookings/${encodeURIComponent(bookingNo)}` // DELETE
  };

  // 時段（你可改）
  const TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00"];

  // DOM ids（盡量相容你目前頁面）
  const DOM = {
    dateInput:
      document.getElementById("datePick") ||
      document.getElementById("date") ||
      document.querySelector('input[type="date"]'),

    slotsGrid: document.getElementById("slotsGrid"),
    loadMsg: document.getElementById("loadMsg"),

    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),

    // modal / login form
    loginModal: document.getElementById("loginModal"),
    btnDoLogin: document.getElementById("btnDoLogin"),
    btnDoRegister: document.getElementById("btnDoRegister"),

    loginName: document.getElementById("loginName"),
    loginPass: document.getElementById("loginPass"),
    registerName: document.getElementById("registerName"),
    registerPass: document.getElementById("registerPass"),
  };

  // =========================
  // Helpers
  // =========================
  function setMsg(text = "", isError = false) {
    if (!DOM.loadMsg) return;
    DOM.loadMsg.textContent = text;
    DOM.loadMsg.classList.toggle("error", !!isError);
  }

  function todayLocalYYYYMMDD() {
    if (typeof window.todayLocalYYYYMMDD === "function") return window.todayLocalYYYYMMDD();
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function openModal() {
    if (!DOM.loginModal) return;
    DOM.loginModal.classList.add("is-open");
    DOM.loginModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    if (!DOM.loginModal) return;
    DOM.loginModal.classList.remove("is-open");
    DOM.loginModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function showLogin() {
  const vLogin = document.getElementById("viewLogin");
  const vReg = document.getElementById("viewRegister");
  if (vLogin) vLogin.style.display = "";
  if (vReg) vReg.style.display = "none";
  }

  function showRegister() {
  const vLogin = document.getElementById("viewLogin");
  const vReg = document.getElementById("viewRegister");
  if (vLogin) vLogin.style.display = "none";
  if (vReg) vReg.style.display = "";
  }

  function isLoggedIn() {
    return !!(window.getToken && window.getToken());
  }

  function requireLoginOrPrompt() {
    if (isLoggedIn()) return true;
    setMsg("請先登入後再進行預約。", true);
    showLogin();     // ✅ 強制顯示登入
    openModal();
    return false;
  }

  function ymddToDateTimeString(ymd, hhmm) {
    // 送給後端用的字串：YYYY-MM-DD HH:MM:00（本地時間）
    return `${ymd} ${hhmm}:00`;
  }

  function safeJson(obj) {
    try { return JSON.stringify(obj); } catch { return ""; }
  }

  // =========================
  // State
  // =========================
  const state = {
    date: "",
    me: null,
    courts: [],        // [{id, name}]
    bookings: [],      // [{booking_no, court_id, start_at, user_display_name? ...}]
    bookingIndex: new Map(), // key = `${court_id}|${HH:MM}`
  };

  // =========================
  // API wrappers
  // =========================
  async function apiGet(path) {
    if (typeof window.api !== "function") throw new Error("common.js 未正確載入（window.api 不存在）");
    return await window.api(path, { method: "GET" });
  }

  async function apiPost(path, bodyObj) {
    if (typeof window.api !== "function") throw new Error("common.js 未正確載入（window.api 不存在）");
    return await window.api(path, {
      method: "POST",
      body: safeJson(bodyObj),
    });
  }

  async function apiDelete(path) {
    if (typeof window.api !== "function") throw new Error("common.js 未正確載入（window.api 不存在）");
    return await window.api(path, { method: "DELETE" });
  }

  // =========================
  // Auth
  // =========================
  async function loadUser() {
    // ✅ 避免 refreshMe 不存在就整個爆掉
    if (typeof window.refreshMe !== "function") {
      console.error("refreshMe not found: common.js 可能 SyntaxError 中斷或未載入");
      state.me = null;
      if (typeof window.setUser === "function") window.setUser(null);
      return null;
    }
    const me = await window.refreshMe();
    state.me = me || null;
    return state.me;
  }

  async function doLogin() {
    const name = DOM.loginName?.value?.trim() || "";
    const pass = DOM.loginPass?.value || "";

    if (!name) { setMsg("請輸入帳號（display_name）", true); return; }
    // 密碼欄若不存在，就允許空字串（方便你先跑通流程）
    // 但你若後端要求密碼，請在 HTML 加上 loginPass input
    const payload = { display_name: name, password: pass };

    setMsg("登入中…");
    try {
      const ret = await apiPost(ENDPOINTS.LOGIN, payload);

      // 常見回傳：{access_token:"...", token_type:"bearer"} 或 {token:"..."}
      const token = ret?.access_token || ret?.token || "";
      if (token && typeof window.setToken === "function") window.setToken(token);

      await loadUser();
      closeModal();
      setMsg("登入成功");
      await refreshAll();
    } catch (e) {
      console.error(e);
      setMsg("登入失敗：" + (e?.message || "unknown error"), true);
    }
  }

  async function doRegister() {
  const name =
    DOM.registerName?.value?.trim() ||
    DOM.loginName?.value?.trim() ||
    "";
  const pass =
    DOM.registerPass?.value ||
    DOM.loginPass?.value ||
    "";

  const emailRaw = DOM.registerEmail?.value?.trim() || DOM.loginEmail?.value?.trim() || "";
  const payload = { display_name: name, password: pass };
  if (emailRaw) payload.email = emailRaw; // ✅ 有填才送

  if (!name || !pass) { setMsg("註冊需要帳號與密碼", true); return; }

  setMsg("註冊中…");
  try {
    await apiPost(ENDPOINTS.REGISTER, payload);
    setMsg("註冊成功，請登入");
    // 註冊成功後，直接切回登入畫面（下面第2點會一起修）
    showLogin();
  } catch (e) {
    console.error(e);
    setMsg("註冊失敗：" + (e?.message || "unknown error"), true);
  }
}

  async function doLogout() {
    // 有些後端有 /logout，有些沒有；我們不強制呼叫
    try {
      if (ENDPOINTS.LOGOUT) await apiPost(ENDPOINTS.LOGOUT, {});
    } catch {}
    if (typeof window.setToken === "function") window.setToken("");
    if (typeof window.setUser === "function") window.setUser(null);
    state.me = null;
    setMsg("已登出");
    await refreshAll();
  }

  // =========================
  // Data load
  // =========================
  async function loadCourts() {
    const data = await apiGet(ENDPOINTS.COURTS);

    // 兼容：可能回傳 {items:[...]} 或直接 [...]
    const rows = Array.isArray(data) ? data : (data?.items || data?.rows || []);
    state.courts = rows.map((r) => ({
      id: r.court_id ?? r.id ?? r.courtId,
      name: r.name ?? r.court_name ?? r.label ?? String(r.court_id ?? r.id ?? "Court"),
    })).filter((c) => c.id != null);

    return state.courts;
  }

  async function loadBookings(dateYMD) {
    const data = await apiGet(`${ENDPOINTS.BOOKINGS}?date=${encodeURIComponent(dateYMD)}`);
    const rows = Array.isArray(data) ? data : (data?.items || data?.rows || []);

    state.bookings = rows;
    state.bookingIndex = new Map();

    for (const b of rows) {
      const courtId = b.court_id ?? b.courtId ?? b.court;
      const startAt = b.start_at ?? b.startAt ?? b.start;
      const bookingNo = b.booking_no ?? b.bookingNo ?? b.id;
      if (!courtId || !startAt) continue;

      // 解析時間：支援 "YYYY-MM-DD HH:MM:SS" 或 ISO
      let hhmm = "";
      if (typeof startAt === "string") {
        const m1 = startAt.match(/\b(\d{2}:\d{2})/);
        if (m1) hhmm = m1[1];
      }
      if (!hhmm) continue;

      const key = `${courtId}|${hhmm}`;
      state.bookingIndex.set(key, {
        bookingNo,
        courtId,
        hhmm,
        raw: b,
      });
    }

    return state.bookings;
  }

  // =========================
  // Render
  // =========================
  function render() {
    if (!DOM.slotsGrid) return;

    DOM.slotsGrid.innerHTML = "";

    // Header row：時間
    const header = document.createElement("div");
    header.className = "grid-row grid-header";
    header.appendChild(cell("球場/時間", "cell head"));

    for (const t of TIMES) header.appendChild(cell(t, "cell head center"));
    DOM.slotsGrid.appendChild(header);

    // Court rows
    for (const court of state.courts) {
      const row = document.createElement("div");
      row.className = "grid-row";
      row.appendChild(cell(court.name, "cell court"));

      for (const t of TIMES) {
        const key = `${court.id}|${t}`;
        const booked = state.bookingIndex.get(key);

        const c = document.createElement("div");
        c.className = "cell center";

        const btn = document.createElement("button");
        btn.type = "button";

        if (booked) {
          btn.className = "btn btn--ghost";
          btn.textContent = "已預約";
          btn.disabled = false;

          btn.addEventListener("click", async () => {
            // 有登入才允許取消（或至少查詢細節）
            if (!requireLoginOrPrompt()) return;

            // 只允許取消自己的（若後端有回傳使用者資訊）
            const raw = booked.raw || {};
            const owner =
              raw.user_id ?? raw.userId ?? raw.owner_id ?? raw.ownerId;
            const myId =
              state.me?.user_id ?? state.me?.id ?? state.me?.userId;

            // 如果後端沒提供 owner，就直接交給後端判斷權限
            if (owner && myId && String(owner) !== String(myId)) {
              setMsg("這筆不是你的預約，無法取消。", true);
              return;
            }

            const ok = confirm(`${court.name} ${state.date} ${t} 要取消預約嗎？`);
            if (!ok) return;

            try {
              await apiDelete(ENDPOINTS.CANCEL(booked.bookingNo));
              setMsg("已取消");
              await refreshAll();
            } catch (e) {
              console.error(e);
              setMsg("取消失敗：" + (e?.message || "unknown error"), true);
            }
          });
        } else {
          btn.className = "btn btn--primary";
          btn.textContent = "可預約";

          btn.addEventListener("click", async () => {
            if (!requireLoginOrPrompt()) return;

            const ok = confirm(`${court.name} ${state.date} ${t} 要預約嗎？`);
            if (!ok) return;

            try {
              // 後端常見需要：court_id + start_at
              const payload = {
                court_id: court.id,
                start_at: ymddToDateTimeString(state.date, t),
              };
              await apiPost(ENDPOINTS.BOOKINGS, payload);
              setMsg("預約成功");
              await refreshAll();
            } catch (e) {
              console.error(e);
              setMsg("預約失敗：" + (e?.message || "unknown error"), true);
            }
          });
        }

        c.appendChild(btn);
        row.appendChild(c);
      }

      DOM.slotsGrid.appendChild(row);
    }
  }

  function cell(text, className) {
    const d = document.createElement("div");
    d.className = className || "cell";
    d.textContent = text;
    return d;
  }

  // =========================
  // Refresh pipeline
  // =========================
  async function refreshAll() {
    if (!state.date) return;

    setMsg("載入中…");
    try {
      // 先確保 user 狀態（不會丟錯造成 init 中斷）
      await loadUser();

      // 資料載入
      if (!state.courts.length) await loadCourts();
      await loadBookings(state.date);

      // Render
      render();
      setMsg("");
    } catch (e) {
      console.error(e);
      setMsg("載入失敗：" + (e?.message || "unknown error"), true);
    }
  }

  // =========================
  // Init
  // =========================
  function init() {
    // ✅ 日期預設今天（本地）
    if (DOM.dateInput) {
      // 強制 type=date（避免被改成 text）
      DOM.dateInput.setAttribute("type", "date");

      // 強制使用 YYYY-MM-DD
      const v = DOM.dateInput.value;
      if (!v || v.includes("/")) {
        DOM.dateInput.value = todayLocalYYYYMMDD();
      }

      state.date = DOM.dateInput.value;

      DOM.dateInput.addEventListener("change", async () => {
        state.date = DOM.dateInput.value || todayLocalYYYYMMDD();
        await refreshAll();
      });
    }

    // Login modal：點背景關閉（可選）
    if (DOM.loginModal) {
      DOM.loginModal.addEventListener("click", (e) => {
        // 只允許點到遮罩本體才關（避免點到內容也關）
        if (e.target === DOM.loginModal) closeModal();
      });

      // 防止點面板時事件冒泡到遮罩造成誤關
      const panel = DOM.loginModal.querySelector(".panel, .modal__panel");
      if (panel) {
        panel.addEventListener("click", (e) => e.stopPropagation());
      }
    }

    // Buttons
    DOM.btnLogin?.addEventListener("click", openModal);
    DOM.btnLogout?.addEventListener("click", doLogout);
    DOM.btnDoLogin?.addEventListener("click", doLogin);
    DOM.btnDoRegister?.addEventListener("click", doRegister);

    // 初始載入
    refreshAll();
  }

  document.addEventListener("DOMContentLoaded", init);

  console.log("booking.js loaded OK", new Date().toISOString());
})();
