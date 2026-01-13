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

  function assertElsOrStop() {
    const missing = [];
    if (!elDate) missing.push("#bookingDate");
    if (!elLoadMsg) missing.push("#loadMsg");
    if (!elSlotsGrid) missing.push("#slotsGrid");
    if (!elCourtSelect) missing.push("#courtSelect");
    if (!elTimeSelect) missing.push("#timeSelect");
    if (!elBtnBook) missing.push("#btnBook");
    if (!elBookingMsg) missing.push("#bookingMsg");

    if (missing.length) {
      const msg = `index.html 缺少必要元素：${missing.join(", ")}。請確認 index.html 的 id 是否正確。`;
      console.error(msg);
      if (elLoadMsg) {
        elLoadMsg.textContent = msg;
        elLoadMsg.classList.add("error");
      } else {
        alert(msg);
      }
      return false;
    }
    return true;
  }

  function msgLoad(text = "", isErr = false) {
    elLoadMsg.textContent = text;
    elLoadMsg.classList.toggle("error", !!isErr);
  }

  function msgBook(text = "", isErr = false) {
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

  // ---------- time utils ----------
  function pad2(n) { return String(n).padStart(2, "0"); }

  // 支援：
  // - "10:00:00" / "10:00"
  // - 36000 (秒) / "36000"
  // - 36000.0
  function normalizeToHHMM(v) {
    if (v == null) return "00:00";

    // number or numeric string => seconds
    const s = String(v).trim();

    // has ":" => time string
    if (s.includes(":")) {
      // "10:00:00" -> "10:00"
      return s.slice(0, 5);
    }

    // pure numeric => seconds
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
    return (hh * 60) + (mm || 0);
  }
  function minutesToHHMM(m) {
    const hh = pad2(Math.floor(m / 60));
    const mm = pad2(m % 60);
    return `${hh}:${mm}`;
  }
  function buildTimes(openHHMM, closeHHMM, slotMinutes) {
    const openM = timeToMinutes(openHHMM);
    const closeM = timeToMinutes(closeHHMM);
    const step = Math.max(1, Number(slotMinutes || 60));

    const arr = [];
    for (let m = openM; m <= closeM; m += step) {
      arr.push(minutesToHHMM(m));
    }
    return arr;
  }

  function toHHMM(dt) {
    const d = new Date(dt);
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    return `${hh}:${mm}`;
  }

  // ---------- hide the right status card (duplicate) ----------
  function hideTopStatusCard() {
    // 盡量不依賴特定 DOM 結構：找包含「目前可預約狀態」的元素，隱藏它的卡片容器
    const nodes = Array.from(document.querySelectorAll("*"))
      .filter(n => n && n.children && n.children.length === 0)
      .filter(n => (n.textContent || "").trim() === "目前可預約狀態");

    // 只隱藏第一個（右邊那張），下面我們自己的表格不會放同樣文字在同層結構
    const first = nodes[0];
    if (!first) return;

    // 往上找一個看起來像 card 的容器（有 border/round/padding 的通常是 div）
    let p = first.parentElement;
    for (let i = 0; i < 6 && p; i++) {
      // heuristic: 若這層包含 slotsGrid 則不要動
      if (p.contains(elSlotsGrid)) return;
      // 看到看起來是卡片（div/section）就停
      if (p.tagName === "DIV" || p.tagName === "SECTION") {
        p.style.display = "none";
        return;
      }
      p = p.parentElement;
    }
  }

  // ---------- UI: select options ----------
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

  function setCourtSelectOptions(courts) {
    elCourtSelect.innerHTML = "";
    const items = courts?.items || [];
    if (items.length === 0) {
      const a = document.createElement("option");
      a.value = "1";
      a.textContent = "羽球A場地";
      const b = document.createElement("option");
      b.value = "2";
      b.textContent = "羽球B場地";
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

  // ---------- data ----------
  async function fetchCourts() {
    return await window.api("/api/courts", { method: "GET" });
  }

  async function fetchCourtRule(courtId) {
    // 你已經新增了這支：/api/courts/{court_id}/rules
    return await window.api(`/api/courts/${encodeURIComponent(courtId)}/rules`, { method: "GET" });
  }

  async function fetchBookings(dateYMD) {
    return await window.api(`/api/bookings?date=${encodeURIComponent(dateYMD)}`, { method: "GET" });
  }

  function buildBookedMap(bookingsResp) {
    const items = bookingsResp?.items || [];
    const map = new Map();
    for (const b of items) {
      const st = String(b.status || "").toLowerCase();
      if (st && (st === "cancelled" || st === "canceled")) continue;
      const courtId = String(b.court_id);
      const hhmm = toHHMM(b.start_at);
      map.set(`${courtId}|${hhmm}`, true);
    }
    return map;
  }

  // ---------- price (single endpoint to avoid 404 spam) ----------
  // 若你後端還沒做，這裡會直接 fallback 250，不會再打一堆 404
  async function fetchPricePlansByCourt(courtId) {
    try {
      const r = await window.api(`/api/courts/${encodeURIComponent(courtId)}/price_plans`, { method: "GET" });
      return Array.isArray(r?.items) ? r.items : [];
    } catch {
      return [];
    }
  }

  function dayMaskMatch(weekdayMask, dateYMD) {
    const mask = Number(weekdayMask ?? 127);
    if (!mask || mask === 127) return true;

    const d = new Date(`${dateYMD}T00:00:00`);
    const jsDay = d.getDay(); // 0 Sun .. 6 Sat

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
    const fallback = { amount: 250, currency: "TWD", name: "預設" };

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

  // ---------- render bottom table ----------
  function renderSlots(bookedMap, courts, TIMES) {
  elSlotsGrid.innerHTML = "";

  const items = (courts?.items?.length ? courts.items : [
    { id: 1, name: "羽球A場地" },
    { id: 2, name: "羽球B場地" },
    { id: 3, name: "籃球A場地" },
    { id: 4, name: "籃球B場地" },
  ]);

  // 固定顯示前 4 個（你目前就是四個場地）
  const showCourts = items.slice(0, 4);

  // ✅ 分隔線：畫在「籃球A」這一欄左邊
  // grid 欄位：1=時間, 2=羽球A, 3=羽球B, 4=籃球A, 5=籃球B
  const SEP_COURT_INDEX = 2; // showCourts[2] = 第三個場地（籃球A） => 在它左邊畫線

  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = `90px ${"1fr ".repeat(showCourts.length).trim()}`;
  wrap.style.gap = "10px";
  wrap.style.alignItems = "center";

  // Header
  wrap.appendChild(cell("時間", true));
  showCourts.forEach((c, idx) => {
    const h = cell(c.name || `Court ${c.id}`, true);
    if (idx === SEP_COURT_INDEX) addSeparatorLeft(h);
    wrap.appendChild(h);
  });

  // Rows
  for (const t of TIMES) {
    wrap.appendChild(cell(t, false));

    showCourts.forEach((c, idx) => {
      const btn = slotButton(String(c.id), t, bookedMap, c.name || `Court ${c.id}`);
      if (idx === SEP_COURT_INDEX) addSeparatorLeft(btn);
      wrap.appendChild(btn);
    });
  }

  elSlotsGrid.appendChild(wrap);

  function cell(text, head) {
    const d = document.createElement("div");
    d.textContent = text;
    d.style.fontWeight = head ? "800" : "600";
    d.style.opacity = head ? "0.95" : "0.88";
    return d;
  }

  function addSeparatorLeft(el) {
    // 垂直分隔線（你想要像兩區塊）
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

      // 用目前選到的 court 取 rules 產 times（支援秒數）
      const rule = await fetchCourtRule(elCourtSelect.value);
      const openHHMM = normalizeToHHMM(rule.open_time);
      const closeHHMM = normalizeToHHMM(rule.close_time);
      const slotM = Number(rule.slot_minutes || 60);

      TIMES = buildTimes(openHHMM, closeHHMM, slotM);
      setTimeSelectOptions(TIMES);

      const bookings = await fetchBookings(dateYMD);
      const bookedMap = buildBookedMap(bookings);

      // 只留下面表格：隱藏右邊那張「目前可預約狀態」
      hideTopStatusCard();

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
    if (!assertElsOrStop()) return;

    elDate.setAttribute("type", "date");
    if (!elDate.value || elDate.value.includes("/")) elDate.value = today();
    elDate.addEventListener("change", refreshAll);

    elCourtSelect.addEventListener("change", refreshAll);
    elBtnBook.addEventListener("click", doBook);

    refreshAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
