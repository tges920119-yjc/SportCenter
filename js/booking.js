// js/booking.js
(function () {
  // ------- helpers -------
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);

  function todayStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function setText(id, msg) {
    const el = $(id);
    if (el) el.textContent = msg ?? "";
  }

  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

  function getUser() {
    try { return JSON.parse(localStorage.getItem("demo_user") || "null"); }
    catch { return null; }
  }
  function setUser(u) {
    if (!u) localStorage.removeItem("demo_user");
    else localStorage.setItem("demo_user", JSON.stringify(u));
  }

  function renderUserUI() {
    const u = getUser();
    const badge = $("userBadge");
    const userName = $("userName");
    const btnLogin = $("btnLogin");
    const btnLogout = $("btnLogout");
    const mineLegend = $("mineLegend");

    if (u) {
      if (userName) userName.textContent = u.name || "User";
      show(badge);
      hide(btnLogin);
      show(btnLogout);
      show(mineLegend);
    } else {
      hide(badge);
      show(btnLogin);
      hide(btnLogout);
      hide(mineLegend);
    }
  }

  // ------- modal wiring (index.html 才有 modal) -------
  function setupLoginModal() {
    const modal = $("loginModal");
    if (!modal) return;

    const btnLogin = $("btnLogin");
    const btnLogout = $("btnLogout");
    const btnDoLogin = $("btnDoLogin");
    const inputName = $("loginName");

    function openModal() {
      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("is-open");
      if (inputName) inputName.focus();
    }
    function closeModal() {
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-open");
    }

    // open
    if (btnLogin) btnLogin.addEventListener("click", openModal);

    // close (點背景/✕/取消)
    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeModal();
    });

    // do login (示範登入：只存 localStorage)
    if (btnDoLogin) {
      btnDoLogin.addEventListener("click", () => {
        const name = (inputName?.value || "").trim() || "User";
        setUser({ name });
        renderUserUI();
        closeModal();
      });
    }

    // logout
    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        setUser(null);
        renderUserUI();
      });
    }
  }

  // ------- API calls -------
  async function getAvailability(date) {
    const q = date ? `?date=${encodeURIComponent(date)}` : "";
    return window.api(`/api/availability${q}`);
  }

  async function listBookings() {
    return window.api(`/api/bookings`);
  }

  // ------- page actions (給 venues/my 用) -------
  async function loadAvailability() {
    const datePick = $("datePick"); // index.html 有
    const date = datePick?.value || todayStr();

    try {
      setText("hintArea", "載入中…");
      const data = await getAvailability(date);

      // venues.html / my.html 如果有 #out 就印在那
      const out = $("out");
      if (out) out.textContent = JSON.stringify(data, null, 2);

      // index.html 如果有 grid，先不硬 render（等你貼 API 格式後我幫你做真正格子狀態）
      const grid = $("grid");
      if (grid) {
        // 暫時把 raw 顯示在 hintArea，確認真的拿到資料
        setText("hintArea", "已載入空位（先顯示 raw 方便對齊）：" + JSON.stringify(data));
      } else {
        setText("hintArea", "載入完成");
      }
    } catch (e) {
      setText("hintArea", "載入失敗：" + e.message);
      alert(e.message);
    }
  }

  async function loadMyBookings() {
    try {
      const data = await listBookings();
      const out = $("out");
      if (out) out.textContent = JSON.stringify(data, null, 2);
      setText("hintArea", "載入完成");
    } catch (e) {
      setText("hintArea", "載入失敗：" + e.message);
      alert(e.message);
    }
  }

  // 讓 HTML 的 onclick 可以呼叫
  window.loadAvailability = loadAvailability;
  window.loadMyBookings = loadMyBookings;

  // ------- init -------
  document.addEventListener("DOMContentLoaded", async () => {
    // 預設日期
    const datePick = $("datePick");
    if (datePick && !datePick.value) datePick.value = todayStr();
    if (datePick) datePick.addEventListener("change", loadAvailability);

    renderUserUI();
    setupLoginModal();

    // 健康檢查（把問題顯示出來，避免你以為沒反應其實是 API 404/CORS）
    try {
      await window.api("/api/health");
      // ok
    } catch (e) {
      console.error(e);
      // 不彈窗，避免干擾；但你可在 console 看錯誤
    }
  });
})();
