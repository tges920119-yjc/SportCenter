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

  // 你要的時間範圍
  const TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00"];

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
      : new Date().toISOString().slice(0, 10);
  }

  function ensureLogin() {
    const token = (typeof window.getToken === "function") ? window.getToken() : "";
    if (token) return true;

    msgBook("請先登入後再預約。", true);
    $("btnLogin")?.click();
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

  function setCourtSelectOptions(courts) {
    if (!elCourtSelect) return;
    elCourtSelect.innerHTML = "";
    // courts: {items:[{id,name}...]}
    const items = courts?.items || [];
    if (items.length === 0) {
      // fallback
      const a = document.createElement("option");
      a.value = "1";
      a.textContent = "A 場";
      const b = document.createElement("option");
      b.value = "2";
      b.textContent = "B 場";
      elCourtSelect.appendChild(a);
      elCourtSelect.appendChild(b);
      return;
    }
    for (const c of items) {
      const op = document.createElement("option");
      op.value = String(c.id);
      op.textContent = c.name || `Court ${c.id}`;
      elCourtSelect.appendChild(op);
    }
  }

  function toHHMM(dt) {
    // dt could be ISO string
    const d = new Date(dt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function buildBookedMap(bookingsResp) {
    // bookingsResp: {items:[{court_id,start_at,...}]}
    const items = bookingsResp?.items || [];
    const map = new Map(); // key `${court_id}|${HH:MM}` -> true
    for (const b of items) {
      const courtId = String(b.court_id);
      const hhmm = toHHMM(b.start_at);
      map.set(`${courtId}|${hhmm}`, true);
    }
    return map;
  }

  function renderSlots(bookedMap, courts) {
    if (!elSlotsGrid) return;
    elSlotsGrid.innerHTML = "";

    const courtItems = courts?.items?.length ? courts.items : [{ id: 1, name: "A 場" }, { id: 2, name: "B 場" }];

    // 只顯示前兩個（A/B）
    const c1 = courtItems[0];
    const c2 = courtItems[1] || courtItems[0];

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "90px 1fr 1fr";
    wrap.style.gap = "10px";
    wrap.style.alignItems = "center";

    wrap.appendChild(cell("時間", true));
    wrap.appendChild(cell(c1.name || "A", true));
    wrap.appendChild(cell(c2.name || "B", true));

    for (const t of TIMES) {
      wrap.appendChild(cell(t, true));

      wrap.appendChild(slotButton(String(c1.id), t, bookedMap, c1.name || "A"));
      wrap.appendChild(slotButton(String(c2.id), t, bookedMap, c2.name || "B"));
    }

    elSlotsGrid.appendChild(wrap);

    function cell(text, head) {
      const d = document.createElement("div");
      d.textContent = text;
      d.style.fontWeight = head ? "700" : "600";
      d.style.opacity = head ? "0.95" : "0.85";
      return d;
    }

    function slotButton(courtId, time, booked, courtName) {
      const isBooked = booked.get(`${courtId}|${time}`) === true;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = isBooked ? "btn btn--ghost" : "btn";
      btn.textContent = isBooked ? "已預約" : "可預約";
      btn.disabled = isBooked;

      btn.addEventListener("click", () => {
        if (!ensureLogin()) return;
        if (elCourtSelect) elCourtSelect.value = courtId;
        if (elTimeSelect) elTimeSelect.value = time;
        msgBook(`已選擇：${courtName} ${time}（按「確認預約」送出）`);
      });

      return btn;
    }
  }

  async function refreshAll() {
    const dateYMD = elDate?.value || today();
    msgLoad("載入中…");
    msgBook("");

    try {
      // 更新登入狀態（不會拋錯中斷）
      if (typeof window.refreshMe === "function") await window.refreshMe();

      // 先抓 courts
      const courts = await window.api("/api/courts", { method: "GET" });
      setCourtSelectOptions(courts);

      // ✅ 後端需要 date query
      const bookings = await window.api(`/api/bookings?date=${encodeURIComponent(dateYMD)}`, { method: "GET" });
      const bookedMap = buildBookedMap(bookings);

      renderSlots(bookedMap, courts);

      msgLoad("");
    } catch (err) {
      console.error(err);
      msgLoad(err?.message || "載入失敗", true);
    }
  }

  async function doBook() {
    if (!ensureLogin()) return;

    const dateYMD = elDate?.value || today();
    const courtId = elCourtSelect?.value;
    const timeHHMM = elTimeSelect?.value;
    const note = (elNote?.value || "").trim();

    if (!courtId || !timeHHMM) {
      msgBook("請選擇球場與時間", true);
      return;
    }

    msgBook("預約中…");

    try {
      const payload = {
        court_id: Number(courtId),
        start_at: `${dateYMD}T${timeHHMM}:00`,
        // end_at 不送也行（後端自動 +1hr）；這裡送也可更明確
        end_at: `${dateYMD}T${timeHHMM}:00`,
        note: note || null
      };

      // 後端會 end_at 無效，所以這裡改成真正 +1hr
      // 直接重新算 end_at：
      const [hh, mm] = timeHHMM.split(":").map(Number);
      const start = new Date(`${dateYMD}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const endHH = String(end.getHours()).padStart(2, "0");
      const endMM = String(end.getMinutes()).padStart(2, "0");
      payload.end_at = `${dateYMD}T${endHH}:${endMM}:00`;

      await window.api("/api/bookings", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      msgBook("預約成功");
      await refreshAll();
    } catch (err) {
      console.error(err);
      msgBook(err?.message || "預約失敗", true);
    }
  }

  function init() {
    if (elDate) {
      elDate.setAttribute("type", "date");
      if (!elDate.value || elDate.value.includes("/")) elDate.value = today();
      elDate.addEventListener("change", refreshAll); // ✅ 換日期就重新抓
    }

    setTimeSelectOptions();
    elBtnBook?.addEventListener("click", doBook);

    refreshAll();
  }

  document.addEventListener("DOMContentLoaded", init);
  console.log("booking.js loaded OK", new Date().toISOString());
})();
