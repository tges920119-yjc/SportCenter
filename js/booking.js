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

  function msgLoad(text = "", isErr = false) {
    elLoadMsg.textContent = text;
    elLoadMsg.classList.toggle("error", !!isErr);
    elLoadMsg.classList.toggle("muted", !isErr);
  }

  function msgBook(text = "", isErr = false) {
    elBookingMsg.textContent = text;
    elBookingMsg.classList.toggle("error", !!isErr);
    elBookingMsg.classList.toggle("muted", !isErr);
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

  // ---------- time utils ----------
  const pad2 = (n) => String(n).padStart(2, "0");

  // 支援：
  // - "10:00:00" / "10:00"
  // - 36000 (秒) / "36000"（你目前就是這種）
  function normalizeToHHMM(v) {
    if (v == null) return "00:00";
    const s = String(v).trim();
    if (s.includes(":")) return s.slice(0, 5);
    if (/^\d+(\.\d+)?$/.test(s)) {
      const sec = Math.floor(Number(s));
      const hh = Math.floor(sec / 3600);
      const mm = Math.floor((sec % 3600) / 60);
      return `${pad2(hh)}:${pad2(mm)}`;
    }
    return "00:00";
  }

  function timeToMinutes(hhmm) {
    const [hh, mm] = String(hhmm || "00:00").split(":").map(Number);
    return hh * 60 + (mm || 0);
  }

  function minutesToHHMM(m) {
    return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
  }

  function buildTimes(openHHMM, closeHHMM, slotMinutes) {
    const openM = timeToMinutes(openHHMM);
    const closeM = timeToMinutes(closeHHMM);
    const step = Math.max(1, Number(slotMinutes || 60));
    const arr = [];
    for (let m = openM; m <= closeM; m += step) arr.push(minutesToHHMM(m));
    return arr;
  }

  function toHHMM(dt) {
    const d = new Date(dt);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  // ---------- API ----------
  async function fetchCourts() {
    return await window.api("/api/courts", { method: "GET" });
  }

  async function fetchCourtRule(courtId) {
    return await window.api(`/api/courts/${encodeURIComponent(courtId)}/rules`, { method: "GET" });
  }

  async function fetchBookings(dateYMD) {
    return await window.api(`/api/bookings?date=${encodeURIComponent(dateYMD)}`, { method: "GET" });
  }

  async function fetchPricePlansByCourt(courtId) {
    try {
      const r = await window.api(`/api/courts/${encodeURIComponent(courtId)}/price_plans`, { method: "GET" });
      return Array.isArray(r?.items) ? r.items : [];
    } catch {
      return [];
    }
  }

  function buildBookedMap(bookingsResp) {
    const items = bookingsResp?.items || [];
    const map = new Map();
    for (const b of items) {
      const st = String(b.status || "").toLowerCase();
      if (st && (st === "cancelled" || st === "canceled")) continue;
      map.set(`${String(b.court_id)}|${toHHMM(b.start_at)}`, true);
    }
    return map;
  }

  // ---------- price ----------
  function dayMaskMatch(weekdayMask, dateYMD) {
    const mask = Number(weekdayMask ?? 127);
    if (!mask || mask === 127) return true;

    const d = new Date(`${dateYMD}T00:00:00`);
    const jsDay = d.getDay(); // 0 Sun .. 6 Sat

    // 兩種 mapping 都接受（避免你 DB 定義差異）
    const bitA = (jsDay === 0) ? 64 : (1 << (jsDay - 1)); // Mon..Sun
    const bitB = (1 << jsDay); // Sun..Sat
    return ((mask & bitA) !== 0) || ((mask & bitB) !== 0);
  }

  function timeInRange(timeHHMM, startHHMM, endHHMM) {
    const t = timeToMinutes(timeHHMM);
    const s = timeToMinutes(startHHMM);
    const e = timeToMinutes(endHHMM);
    return t >= s && t <= e;
  }

  async function computePriceForSelection(courtId, dateYMD, timeHHMM) {
    const fallback = { amount: 250, currency: "TWD", name: "標準費率" };

    const plans = await fetchPricePlansByCourt(courtId);
    if (!plans.length) return fallback;

    const candidates = plans.filter(p => {
      if (Number(p.is_active ?? 1) !== 1) return false;
      if (!dayMaskMatch(p.weekday_mask, dateYMD)) return false;
      const st = normalizeToHHMM(p.start_time ?? "00:00:00");
      const et = normalizeToHHMM(p.end_time ?? "23:59:59");
      return timeInRange(timeHHMM, st, et);
    });

    const best = candidates[0] || plans[0];
    return {
      amount: Number(best.price_per_slot ?? 250),
      currency: String(best.currency || "TWD"),
      name: String(best.name || "單次費用"),
    };
  }

  // ---------- UI helpers ----------
  function setCourtSelectOptions(courts) {
    if (!elCourtSelect) return;

    // ✅ 記住目前選的 courtId
    const prev = String(elCourtSelect.value || "");

    elCourtSelect.innerHTML = "";
    const items = courts?.items || [];

    for (const c of items) {
      const op = document.createElement("option");
      op.value = String(c.id);
      op.textContent = c.name || `Court ${c.id}`;
      elCourtSelect.appendChild(op);
    }

    // ✅ 重建後還原原本選擇（找不到就不管）
    if (prev && items.some(x => String(x.id) === prev)) {
      elCourtSelect.value = prev;
    }
  }

  function setTimeSelectOptions(times) {
    elTimeSelect.innerHTML = "";
    for (const t of times) {
      const op = document.createElement("option");
      op.value = t;
      op.textContent = t;
      elTimeSelect.appendChild(op);
    }
    if (times.length) elTimeSelect.value = times[0];
  }

  // 你要的表頭：時間 羽球A場 羽球B場 | 籃球A場 籃球B場（中間有線）
  function renderSlots(bookedMap, courts, TIMES) {
    elSlotsGrid.innerHTML = "";

    const items = courts?.items || [];
    const showCourts = items.slice(0, 4); // 四個場地

    // 分隔線畫在「籃球A」左邊（第 3 個場地）
    const SEP_INDEX = 2;

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = `90px ${"1fr ".repeat(showCourts.length).trim()}`;
    wrap.style.gap = "10px";
    wrap.style.alignItems = "center";

    // Header row
    wrap.appendChild(cell("時間", true));
    showCourts.forEach((c, idx) => {
      const h = cell((c.name || `Court ${c.id}`).replace("場地", ""), true);
      if (idx === SEP_INDEX) addSeparatorLeft(h);
      wrap.appendChild(h);
    });

    // Time rows
    for (const t of TIMES) {
      wrap.appendChild(cell(t, false));
      showCourts.forEach((c, idx) => {
        const btn = slotButton(String(c.id), t, bookedMap, c.name || `Court ${c.id}`);
        if (idx === SEP_INDEX) addSeparatorLeft(btn);
        wrap.appendChild(btn);
      });
    }

    elSlotsGrid.appendChild(wrap);

    function cell(text, head) {
      const d = document.createElement("div");
      d.textContent = text;
      d.style.fontWeight = head ? "900" : "700";
      d.style.opacity = head ? "0.95" : "0.90";
      return d;
    }

    function addSeparatorLeft(el) {
      el.style.borderLeft = "2px solid rgba(0,0,0,0.12)";
      el.style.paddingLeft = "12px";
      el.style.marginLeft = "2px";
    }

    function slotButton(courtId, time, booked, courtName) {
      const isBooked = booked.get(`${courtId}|${time}`) === true;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = isBooked ? "btn btn--ghost" : "btn";
      btn.textContent = isBooked ? "已預約" : "可預約";
      btn.disabled = isBooked;

      btn.addEventListener("click", async () => {
        if (!ensureLogin()) return;
        elCourtSelect.value = courtId;
        elTimeSelect.value = time;

        const dateYMD = elDate.value || today();
        const price = await computePriceForSelection(courtId, dateYMD, time);

        msgBook(`已選擇：${courtName} ${time}｜金額：${price.amount} ${price.currency}（${price.name}）按「確認預約」送出`);
      });

      return btn;
    }
  }

  // ---------- main ----------
  let TIMES = [];

  async function refreshAll() {
    const dateYMD = elDate.value || today();
    msgLoad("載入中…");
    msgBook("");

    try {
      if (typeof window.refreshMe === "function") {
        try { await window.refreshMe(); } catch (_) {}
      }

      const courts = await fetchCourts();
      setCourtSelectOptions(courts);

      // 用目前選到的 court rules 生成時間
      const rule = await fetchCourtRule(elCourtSelect.value);
      const openHHMM = normalizeToHHMM(rule.open_time);
      const closeHHMM = normalizeToHHMM(rule.close_time);
      const slotM = Number(rule.slot_minutes || 60);

      TIMES = buildTimes(openHHMM, closeHHMM, slotM);
      setTimeSelectOptions(TIMES);

      const bookings = await fetchBookings(dateYMD);
      const bookedMap = buildBookedMap(bookings);

      renderSlots(bookedMap, courts, TIMES);

      msgLoad("");
    } catch (err) {
      console.error(err);
      msgLoad(err?.message || "載入失敗", true);
    }
  }

  async function doBook() {
    if (!ensureLogin()) return;

    const dateYMD = elDate.value || today();
    const courtId = elCourtSelect.value;
    const timeHHMM = elTimeSelect.value;
    const note = (elNote?.value || "").trim();

    if (!courtId || !timeHHMM) {
      msgBook("請選擇球場與時間", true);
      return;
    }

    msgBook("預約中…");

    try {
      const start = new Date(`${dateYMD}T${timeHHMM}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const endHH = pad2(end.getHours());
      const endMM = pad2(end.getMinutes());

      const price = await computePriceForSelection(courtId, dateYMD, timeHHMM);

      const payload = {
        court_id: Number(courtId),
        start_at: `${dateYMD}T${timeHHMM}:00`,
        end_at: `${dateYMD}T${endHH}:${endMM}:00`,
        note: note || null,
        price_amount: price.amount,
        currency: price.currency
      };

      await window.api("/api/bookings", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      msgBook(`✅ 預約成功｜金額：${price.amount} ${price.currency}`);
      await refreshAll();
    } catch (err) {
      console.error(err);
      msgBook(err?.message || "預約失敗", true);
    }
  }

  function init() {
    if (!elDate || !elSlotsGrid || !elCourtSelect || !elTimeSelect || !elBtnBook) {
      console.error("booking.js missing required elements");
      return;
    }

    elDate.setAttribute("type", "date");
    if (!elDate.value || elDate.value.includes("/")) elDate.value = today();

    elDate.addEventListener("change", refreshAll);
    elCourtSelect.addEventListener("change", refreshAll);
    elBtnBook.addEventListener("click", doBook);

    refreshAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
