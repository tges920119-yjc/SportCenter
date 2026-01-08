// js/booking.js
(() => {
  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  function todayStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function setHint(msg) {
    const el = $("hintArea");
    if (el) el.textContent = msg || "";
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem("demo_user") || "null");
    } catch {
      return null;
    }
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
      if (badge) badge.hidden = false;
      if (btnLogin) btnLogin.hidden = true;
      if (btnLogout) btnLogout.hidden = false;
      if (mineLegend) mineLegend.hidden = false;
    } else {
      if (userName) userName.textContent = "User";
      if (badge) badge.hidden = true;
      if (btnLogin) btnLogin.hidden = false;
      if (btnLogout) btnLogout.hidden = true;
      if (mineLegend) mineLegend.hidden = true;
    }
  }

  // ---------- Modal (index.html 才有) ----------
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

    if (btnLogin) btnLogin.addEventListener("click", openModal);

    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeModal();
    });

    if (btnDoLogin) {
      btnDoLogin.addEventListener("click", () => {
        const name = (inputName?.value || "").trim() || "User";
        setUser({ name });
        renderUserUI();
        closeModal();
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        setUser(null);
        renderUserUI();
      });
    }
  }

  // ---------- API wrappers (common.js 提供 window.api) ----------
  async function getAvailability(courtId, dateStr) {
    const qs = new URLSearchParams({
      court_id: String(courtId),
      date: dateStr,
    });
    return window.api(`/api/availability?${qs.toString()}`);
  }

  async function listBookings() {
    return window.api(`/api/bookings`);
  }

  async function createBooking(payload) {
    return window.api(`/api/bookings`, {
      method: "POST",
      body: payload,
    });
  }

  async function cancelBooking(bookingId) {
    return window.api(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: "POST",
    });
  }

  // ---------- Render grid (index.html) ----------
  function fmtHHMM(isoStr) {
    // "2026-01-08T08:00:00" -> "08:00"
    if (!isoStr) return "";
    const t = isoStr.split("T")[1] || "";
    return t.slice(0, 5);
  }

  function buildCell({ courtLabel, slot, isAvailable, onBook }) {
    // 用你現有的 CSS 命名：chip--free / chip--taken / chip--mine（你有 legend）
    const card = document.createElement("div");
    card.className = "slot"; // 如果你 CSS 不是 slot，也沒關係，至少會顯示；要更美我再對齊 class

    const start = fmtHHMM(slot.start_at);
    const end = fmtHHMM(slot.end_at);

    const stateChipClass = isAvailable ? "chip chip--free" : "chip chip--taken";
    const stateText = isAvailable ? "可預約" : "已被租走";

    card.innerHTML = `
      <div class="slot__top">
        <div class="slot__court">Court ${courtLabel}</div>
        <div class="slot__time">${start} - ${end}</div>
      </div>

      <div class="slot__meta">
        <span class="${stateChipClass}">${stateText}</span>
      </div>

      <div class="slot__actions"></div>
    `;

    const actions = card.querySelector(".slot__actions");
    if (isAvailable) {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "預約";
      btn.addEventListener("click", onBook);
      actions.appendChild(btn);
    }

    return card;
  }

  async function renderIndexGrid(dateStr) {
    const grid = $("grid");
    if (!grid) return;

    setHint("載入中...");
    grid.innerHTML = "";

    try {
      const [a, b] = await Promise.all([
        getAvailability(1, dateStr),
        getAvailability(2, dateStr),
      ]);

      // 保底：如果回傳不是 ok，就顯示錯誤
      if (!a?.ok || !b?.ok) {
        setHint("availability 回傳格式不正確");
        return;
      }

      // a.slots / b.slots
      const groups = [
        { label: "A", court_id: 1, slots: a.slots || [] },
        { label: "B", court_id: 2, slots: b.slots || [] },
      ];

      // 讓 grid 依照「時間」排序，再依 A/B 生成
      // 你 UI 想要 A、B 分區或混排都可以；先用「先 A 再 B」
      for (const g of groups) {
        for (const slot of g.slots) {
          const isAvailable = Number(slot.is_available) === 1;

          const cell = buildCell({
            courtLabel: g.label,
            slot,
            isAvailable,
            onBook: async () => {
              try {
                // 這裡 payload 先用你常見欄位：court_id + start_at
                // 若你的後端還需要 user_id / name / phone 等，我再依錯誤訊息補上
                setHint("預約中...");
                await createBooking({
                  court_id: g.court_id,
                  start_at: slot.start_at,
                });
                setHint("預約成功，重新載入...");
                await renderIndexGrid(dateStr);
              } catch (e) {
                alert(e.message);
                setHint("預約失敗：" + e.message);
              }
            },
          });

          grid.appendChild(cell);
        }
      }

      setHint("載入完成");
    } catch (e) {
      console.error(e);
      setHint("載入失敗：" + e.message);
    }
  }

  // ---------- Support venues.html / my.html (可選，保底顯示 JSON) ----------
  // 讓你在 venues.html 可以按「載入場地」時顯示 raw（如果你有 #out）
  async function loadAvailabilityRaw() {
    const dateStr = ($("datePick")?.value || todayStr());
    try {
      const [a, b] = await Promise.all([
        getAvailability(1, dateStr),
        getAvailability(2, dateStr),
      ]);
      const out = $("out");
      if (out) out.textContent = JSON.stringify({ A: a, B: b }, null, 2);
      setHint("載入完成");
    } catch (e) {
      alert(e.message);
      setHint("載入失敗：" + e.message);
    }
  }

  async function loadMyBookingsRaw() {
    try {
      const data = await listBookings();
      const out = $("out");
      if (out) out.textContent = JSON.stringify(data, null, 2);
      setHint("載入完成");
    } catch (e) {
      alert(e.message);
      setHint("載入失敗：" + e.message);
    }
  }

  // 暴露給 onclick 用（如果你 venues.html / my.html 有用到）
  window.loadAvailability = loadAvailabilityRaw;
  window.loadMyBookings = loadMyBookingsRaw;
  window.cancelBooking = cancelBooking; // 之後 my.html 做取消按鈕可用

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    // 基本 UI
    renderUserUI();
    setupLoginModal();

    // index.html 日期選擇
    const datePick = $("datePick");
    if (datePick) {
      if (!datePick.value) datePick.value = todayStr();
      datePick.addEventListener("change", () => {
        renderIndexGrid(datePick.value);
      });
      renderIndexGrid(datePick.value);
    }

    // 可選：健康檢查（不彈窗）
    try {
      await window.api("/api/health");
    } catch (e) {
      console.warn("API health failed:", e.message);
    }
  });
})();
