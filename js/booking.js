(() => {
  "use strict";
  console.log("[booking.js] loaded OK");

  const $ = (id) => document.getElementById(id);

  const elDate = $("bookingDate");
  const elLoadMsg = $("loadMsg");
  const elSlotsGrid = $("slotsGrid");
  const elCourtSelect = $("courtSelect");
  const elTimeSelect = $("timeSelect");
  const elNote = $("note");
  const elBtnBook = $("btnBook");
  const elBookingMsg = $("bookingMsg");

  function today() {
    return (typeof window.todayLocalYYYYMMDD === "function")
      ? window.todayLocalYYYYMMDD()
      : new Date().toISOString().slice(0, 10);
  }

  function msgLoad(t = "", e = false) {
    elLoadMsg.textContent = t;
    elLoadMsg.classList.toggle("error", e);
  }
  function msgBook(t = "", e = false) {
    elBookingMsg.textContent = t;
    elBookingMsg.classList.toggle("error", e);
  }

  function ensureLogin() {
    if (typeof window.getToken === "function" && window.getToken()) return true;
    msgBook("請先登入後再預約", true);
    $("btnLogin")?.click();
    return false;
  }

  function timeToMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }
  function minutesToHHMM(m) {
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }
  function buildTimes(open, close, slot) {
    const arr = [];
    for (let m = timeToMinutes(open); m <= timeToMinutes(close); m += slot) {
      arr.push(minutesToHHMM(m));
    }
    return arr;
  }

  async function fetchRules(courtId) {
    return await window.api(`/api/courts/${courtId}/rules`, { method: "GET" });
  }

  async function fetchCourts() {
    return await window.api("/api/courts", { method: "GET" });
  }

  async function fetchBookings(date) {
    return await window.api(`/api/bookings?date=${encodeURIComponent(date)}`, { method: "GET" });
  }

  function buildBookedMap(resp) {
    const map = new Map();
    for (const b of resp.items || []) {
      const t = new Date(b.start_at);
      const hhmm = String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0");
      map.set(`${b.court_id}|${hhmm}`, true);
    }
    return map;
  }

  function setCourtOptions(courts) {
    elCourtSelect.innerHTML = "";
    for (const c of courts.items) {
      const op = document.createElement("option");
      op.value = c.id;
      op.textContent = c.name;
      elCourtSelect.appendChild(op);
    }
  }

  function setTimeOptions(times) {
    elTimeSelect.innerHTML = "";
    for (const t of times) {
      const op = document.createElement("option");
      op.value = t;
      op.textContent = t;
      elTimeSelect.appendChild(op);
    }
    elTimeSelect.value = times[0]; // 預設第一個可選
  }

  function render(booked, courts, times) {
    elSlotsGrid.innerHTML = "";

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `80px ${"1fr ".repeat(courts.length)}`;

    grid.appendChild(cell("時間", true));
    for (const c of courts) grid.appendChild(cell(c.name, true));

    for (const t of times) {
      grid.appendChild(cell(t));
      for (const c of courts) {
        const key = `${c.id}|${t}`;
        const isBooked = booked.get(key);

        const btn = document.createElement("button");
        btn.className = isBooked ? "btn btn--ghost" : "btn";
        btn.textContent = isBooked ? "已預約" : "可預約";
        btn.disabled = isBooked;

        btn.onclick = () => {
          if (!ensureLogin()) return;
          elCourtSelect.value = c.id;
          elTimeSelect.value = t;
          msgBook(`已選擇 ${c.name} ${t}`);
        };

        grid.appendChild(btn);
      }
    }

    elSlotsGrid.appendChild(grid);

    function cell(t, h) {
      const d = document.createElement("div");
      d.textContent = t;
      d.style.fontWeight = h ? "700" : "600";
      return d;
    }
  }

  async function refresh() {
    msgLoad("載入中…");

    const date = elDate.value || today();

    const courts = await fetchCourts();
    setCourtOptions(courts);

    const rules = await fetchRules(elCourtSelect.value);
    const times = buildTimes(rules.open_time.slice(0,5), rules.close_time.slice(0,5), rules.slot_minutes);

    setTimeOptions(times);

    const bookings = await fetchBookings(date);
    const bookedMap = buildBookedMap(bookings);

    render(bookedMap, courts.items.slice(0,4), times);
    msgLoad("");
  }

  async function doBook() {
    if (!ensureLogin()) return;

    const date = elDate.value || today();
    const time = elTimeSelect.value;
    const court = elCourtSelect.value;

    const start = `${date}T${time}:00`;
    const end = new Date(new Date(start).getTime() + 60 * 60000);
    const endAt = `${date}T${String(end.getHours()).padStart(2,"0")}:${String(end.getMinutes()).padStart(2,"0")}:00`;

    await window.api("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        court_id: Number(court),
        start_at: start,
        end_at: endAt,
        note: elNote.value || null
      })
    });

    msgBook("預約成功");
    refresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    elDate.value = today();
    elDate.onchange = refresh;
    elCourtSelect.onchange = refresh;
    elBtnBook.onclick = doBook;
    refresh();
  });

})();
