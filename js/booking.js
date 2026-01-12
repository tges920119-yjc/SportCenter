/* js/booking.js */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const elDate = $("bookingDate");
  const elLoadMsg = $("loadMsg");
  const elSlotsGrid = $("slotsGrid");

  const elCourtSelect = $("courtSelect");
  const elTimeSelect = $("timeSelect");
  const elNote = $("note");
  const elBtnBook = $("btnBook");
  const elBookingMsg = $("bookingMsg");

  const TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00"];

  // 你後端的預約 API 若不同，改這裡就好
  const ENDPOINTS = {
    COURTS: "/api/courts",
    BOOKINGS: "/api/bookings",                 // GET ?date=YYYY-MM-DD ; POST
    CANCEL: (bookingNo) => `/api/bookings/${encodeURIComponent(bookingNo)}` // DELETE
  };

  function msgLoad(text = "", isErr = false) {
    if (!elLoadMsg) return;
    elLoadMsg.textContent = text;
    elLoadMsg.classList.toggle("error", !!isErr);
  }

  function msgBook(text = "", isErr = false) {
    if (!elBookingMsg) return;
    elBookingMsg.textContent = text;
    elBookingMsg.classList.toggle("error", !!isErr);
  }

  function today() {
    return (typeof window.todayLocalYYYYMMDD === "function")
      ? window.todayLocalYYYYMMDD()
      : (() => {
          const d = new Date();
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        })();
  }

  function ensureLogin() {
    const token = (typeof window.getToken === "function") ? window.getToken() : "";
    if (token) return true;

    msgBook("請先登入後再進行預約。", true);
    // 強制回登入模式再開 modal（避免跳註冊）
    const btnLogin = $("btnLogin");
    if (btnLogin) btnLogin.click();
    return false;
  }

  function setTimeSelectOptions() {
    if (!elTimeSelect) return;
    elTimeSelect.innerHTML = "";
    for (const t of TIMES) {
      const op = document.createElement("option");
      op.value = t;
      op.textContent = t;
      elTimeSelect.appendChild(op);
    }
  }

  function renderSimpleSlots() {
    // 你目前 UI 已經有 slotsGrid 與按鈕；這裡先簡單渲染「可預約」佔位
    // 若你已經有更完整的 slotsGrid 邏輯，可保留你的版本，把這段刪掉。
    if (!elSlotsGrid) return;
    elSlotsGrid.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "80px 1fr 1fr";
    wrap.style.gap = "10px";
    wrap.style.alignItems = "center";

    // header
    wrap.appendChild(cell("球場/時間", true));
    wrap.appendChild(cell("A", true));
    wrap.appendChild(cell("B", true));

    for (const t of TIMES) {
      wrap.appendChild(cell(t, true));

      const a = document.createElement("button");
      a.type = "button";
      a.className = "btn btn--primary";
      a.textContent = "可預約";
      a.addEventListener("click", () => {
        if (!ensureLogin()) return;
        if (elCourtSelect) elCourtSelect.value = "1";
        if (elTimeSelect) elTimeSelect.value = t;
        msgBook(`已選擇 A 場 ${t}，請按「確認預約」。`);
      });

      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn--primary";
      b.textContent = "可預約";
      b.addEventListener("click", () => {
        if (!ensureLogin()) return;
        if (elCourtSelect) elCourtSelect.value = "2";
        if (elTimeSelect) elTimeSelect.value = t;
        msgBook(`已選擇 B 場 ${t}，請按「確認預約」。`);
      });

      wrap.appendChild(a);
      wrap.appendChild(b);
    }

    elSlotsGrid.appendChild(wrap);

    function cell(text, head) {
      const d = document.createElement("div");
      d.textContent = text;
      d.style.fontWeight = head ? "700" : "600";
      d.style.opacity = head ? "0.95" : "0.85";
      return d;
    }
  }

  async function refreshAll() {
    msgLoad("載入中…");
    try {
      // 更新登入狀態（不會拋錯中斷）
      if (typeof window.refreshMe === "function") await window.refreshMe();

      // 這裡如果你要讀取後端 courts/bookings，可以再補，
      // 目前先讓 UI 正常可操作、避免卡住。
      renderSimpleSlots();
      msgLoad("");
    } catch (err) {
      console.error(err);
      msgLoad(err?.message || "載入失敗", true);
    }
  }

  async function doBook() {
    if (!ensureLogin()) return;

    const dateYMD = elDate?.value || today();
    const courtId = elCourtSelect?.value || "1";
    const timeHHMM = elTimeSelect?.value || TIMES[0];
    const note = (elNote?.value || "").trim();

    msgBook("預約中…");

    try {
      // 後端常見 payload：court_id + start_at (+ note)
      const payload = {
        court_id: Number(courtId),
        start_at: `${dateYMD} ${timeHHMM}:00`,
      };
      if (note) payload.note = note;

      await window.api(ENDPOINTS.BOOKINGS, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      msgBook("預約成功");
      await refreshAll();
    } catch (err) {
      console.error(err);
      msgBook(err?.message || "預約失敗", true);
    }
  }

  function init() {
    // 日期強制 type=date + YYYY-MM-DD
    if (elDate) {
      elDate.setAttribute("type", "date");
      if (!elDate.value || elDate.value.includes("/")) elDate.value = today();
      elDate.addEventListener("change", refreshAll);
    }

    setTimeSelectOptions();

    elBtnBook?.addEventListener("click", doBook);

    refreshAll();
  }

  document.addEventListener("DOMContentLoaded", init);
  console.log("booking.js loaded OK", new Date().toISOString());
})();
