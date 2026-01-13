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

  // ---------- 基本檢查 ----------
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

  // ---------- 訊息 ----------
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

  // ---------- 日期/時間工具 ----------
  function today() {
    // 你 common.js 已有 todayLocalYYYYMMDD()，優先用它避免 UTC 偏差
    return (typeof window.todayLocalYYYYMMDD === "function")
      ? window.todayLocalYYYYMMDD()
      : new Date().toISOString().slice(0, 10);
  }

  function timeToMinutes(t) {
    const [hh, mm] = String(t || "00:00").split(":").map(Number);
    return (hh * 60) + (mm || 0);
  }
  function minutesToHHMM(m) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  function pickHHMM(t) {
    const s = String(t || "");
    return s.length >= 5 ? s.slice(0, 5) : s;
  }
  function buildTimes(openTimeHHMM, closeTimeHHMM, slotMinutes) {
    const openM = timeToMinutes(openTimeHHMM);
    const closeM = timeToMinutes(closeTimeHHMM);
    const step = Number(slotMinutes || 60);

    const arr = [];
    for (let m = openM; m <= closeM; m += step) {
      arr.push(minutesToHHMM(m));
    }
    return arr;
  }

  function toHHMM(dt) {
    // dt could be ISO string
    const d = new Date(dt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // ---------- Login ----------
  function ensureLogin() {
    const token = (typeof window.getToken === "function") ? window.getToken() : "";
    if (token) return true;

    msgBook("請先登入後再預約。", true);
    $("btnLogin")?.click();
    return false;
  }

  // ---------- UI：select options ----------
  function setCourtSelectOptions(courts) {
    if (!elCourtSelect) return;
    elCourtSelect.innerHTML = "";
    const items = courts?.items || [];
    if (items.length === 0) {
      // fallback
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

  function setTimeSelectOptions(times) {
    if (!elTimeSelect) return;
    elTimeSelect.innerHTML = "";
    for (const t of times) {
      const op = document.createElement("option");
      op.value = t;
      op.textContent = t;
      elTimeSelect.appendChild(op);
    }
  }

  // ---------- 把狀態區塊移到頁面下方 ----------
  function moveSlotsGridToBottom() {
    if (!elSlotsGrid) return;

    // 找一個比較合理的容器：main > container > body
    const main =
      document.querySelector("main") ||
      document.querySelector(".container") ||
      document.body;

    // 建一個區塊標題 + slotsGrid 放一起
    let section = document.getElementById("availabilitySection");
    if (!section) {
      section = document.createElement("section");
      section.id = "availabilitySection";
      section.style.marginTop = "18px";

      const h = document.createElement("div");
      h.textContent = "目前可預約狀態";
      h.style.fontWeight = "800";
      h.style.fontSize = "16px";
      h.style.margin = "8px 0 10px";
      section.appendChild(h);

      // 插到 main 最底
      main.appendChild(section);
    }

    // 把 slotsGrid 挪進 section（避免在右邊擠）
    if (elSlotsGrid.parentElement !== section) {
      section.appendChild(elSlotsGrid);
    }
  }

  // ---------- 資料：booked map ----------
  function buildBookedMap(bookingsResp) {
    // bookingsResp: {items:[{court_id,start_at,...}]}
    const items = bookingsResp?.items || [];
    const map = new Map(); // key `${court_id}|${HH:MM}` -> true
    for (const b of items) {
      const courtId = String(b.court_id);
      const hhmm = toHHMM(b.start_at);
      // 如果你有取消狀態，這裡可以排除 cancelled
      const st = String(b.status || "").toLowerCase();
      if (st && (st === "cancelled" || st === "canceled")) continue;
      map.set(`${courtId}|${hhmm}`, true);
    }
    return map;
  }

  // ---------- 價格：從 price plans 估算金額 ----------
  // 會嘗試抓 /api/court_price_plans?court_id=... 或 /api/price_plans?court_id=...
  // 找到適用方案後回傳 price_per_slot + currency
  async function fetchPricePlans(courtId) {
    const paths = [
      `/api/court_price_plans?court_id=${encodeURIComponent(courtId)}`,
      `/api/price_plans?court_id=${encodeURIComponent(courtId)}`,
      `/api/courts/${encodeURIComponent(courtId)}/price_plans`,
    ];
    for (const p of paths) {
      try {
        const r = await window.api(p, { method: "GET" });
        const items = r?.items || [];
        if (Array.isArray(items)) return items;
      } catch (e) {
        // try next
      }
    }
    return [];
  }

  function dayMaskMatch(weekdayMask, dateYMD) {
    // 你的 weekday_mask 欄位是 tinyint，常見兩種 mapping：
    // A) bit0=Mon(1) ... bit5=Sat(32) bit6=Sun(64)
    // B) bit0=Sun(1) ... bit6=Sat(64)
    // 我們兩種都試，只要其中一種 match 就算 match。
    const mask = Number(weekdayMask ?? 127);
    if (!mask || mask === 127) return true;

    const d = new Date(`${dateYMD}T00:00:00`);
    const jsDay = d.getDay(); // 0 Sun ... 6 Sat

    // mapping A:
    const bitA = (jsDay === 0) ? 64 : (1 << (jsDay - 1));
    // mapping B:
    const bitB = (1 << jsDay);

    return ((mask & bitA) !== 0) || ((mask & bitB) !== 0);
  }

  function timeInRange(timeHHMM, startHHMM, endHHMM) {
    const t = timeToMinutes(timeHHMM);
    const s = timeToMinutes(startHHMM);
    const e = timeToMinutes(endHHMM);
    return t >= s && t <= e;
  }

  async function computePriceForSelection(courtId, dateYMD, timeHHMM) {
    // 預設 fallback（你目前常用 250 TWD）
    let fallback = { amount: 250, currency: "TWD", name: "（預設）" };

    try {
      const plans = await fetchPricePlans(courtId);
      if (!plans.length) return fallback;

      // 找最合適的方案：is_active=1 且 weekday_mask match 且 time在範圍內
      const candidates = plans.filter(p => {
        if (Number(p.is_active ?? 1) !== 1) return false;
        if (!dayMaskMatch(p.weekday_mask, dateYMD)) return false;
        const st = pickHHMM(p.start_time || "00:00:00");
        const et = pickHHMM(p.end_time || "23:59:59");
        return timeInRange(timeHHMM, st, et);
      });

      const best = candidates[0] || plans[0];
      const amount = Number(best.price_per_slot ?? best.price ?? 250);
      const currency = String(best.currency || "TWD");
      const name = String(best.name || "單次費用");
      return { amount, currency, name };
    } catch (e) {
      return fallback;
    }
  }

  // ---------- rules：產生時間（不再固定八點） ----------
  async function fetchCourtRule(courtId) {
    const paths = [
      `/api/courts/${encodeURIComponent(courtId)}/rules`,
      `/api/court_rules?court_id=${encodeURIComponent(courtId)}`,
      `/api/rules?court_id=${encodeURIComponent(courtId)}`,
    ];
    for (const p of paths) {
      try {
        const r = await window.api(p, { method: "GET" });
        // r could be object or {item} or {items:[...]}
        const rule =
          r?.item ||
          (Array.isArray(r?.items) ? r.items[0] : null) ||
          r;
        if (rule && (rule.open_time || rule.close_time || rule.slot_minutes)) return rule;
      } catch (e) {
        // try next
      }
    }
    return null;
  }

  async function computeTimesFromRules(courts) {
    // 取第一個 court 的 rule 當作全體時間（目前你資料模型大多是一樣的）
    // 若未來不同 court 不同時間，再擴充成 per-court 的 times。
    const items = courts?.items || [];
    if (!items.length) {
      return ["08:00", "09:00", "10:00", "11:00", "12:00"];
    }

    const anyCourtId = items[0].id;
    const rule = await fetchCourtRule(anyCourtId);
    if (!rule) {
      // fallback
      return ["08:00", "09:00", "10:00", "11:00", "12:00"];
    }

    const openT = pickHHMM(rule.open_time || "08:00:00");
    const closeT = pickHHMM(rule.close_time || "12:00:00");
    const slotM = Number(rule.slot_minutes || 60);

    const times = buildTimes(openT, closeT, slotM);
    return times.length ? times : ["08:00", "09:00", "10:00", "11:00", "12:00"];
  }

  // ---------- UI：render（四個場地一次顯示） ----------
  // 會畫成：時間 + 4 個場地欄位
  function renderSlots(bookedMap, courts, TIMES) {
    if (!elSlotsGrid) return;
    elSlotsGrid.innerHTML = "";

    const items = (courts?.items?.length ? courts.items : [
      { id: 1, name: "羽球A場地" },
      { id: 2, name: "羽球B場地" },
    ]);

    // ✅ 你要「四個場地全部顯示」
    // 這裡就直接用 items 的前 4 個（若你 DB 超過 4 個也會顯示更多）
    const showCourts = items.slice(0, 4);

    // 外層：可橫向捲動，避免欄位太擠
    const outer = document.createElement("div");
    outer.style.overflowX = "auto";
    outer.style.paddingBottom = "6px";

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = `90px ${"1fr ".repeat(showCourts.length).trim()}`;
    wrap.style.gap = "10px";
    wrap.style.alignItems = "center";
    wrap.style.minWidth = `${90 + showCourts.length * 140}px`;

    // header
    wrap.appendChild(cell("時間", true));
    for (const c of showCourts) {
      wrap.appendChild(cell(c.name || `Court ${c.id}`, true));
    }

    // rows
    for (const t of TIMES) {
      wrap.appendChild(cell(t, false));
      for (const c of showCourts) {
        wrap.appendChild(slotButton(String(c.id), t, bookedMap, c.name || `Court ${c.id}`));
      }
    }

    outer.appendChild(wrap);
    elSlotsGrid.appendChild(outer);

    function cell(text, head) {
      const d = document.createElement("div");
      d.textContent = text;
      d.style.fontWeight = head ? "800" : "600";
      d.style.opacity = head ? "0.95" : "0.88";
      return d;
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

        if (elCourtSelect) elCourtSelect.value = courtId;
        if (elTimeSelect) elTimeSelect.value = time;

        // ✅ 顯示金額
        const dateYMD = elDate?.value || today();
        const price = await computePriceForSelection(courtId, dateYMD, time);

        msgBook(
          `已選擇：${courtName} ${time}｜金額：${price.amount} ${price.currency}（${price.name}）\n按「確認預約」送出`
        );
      });

      return btn;
    }
  }

  // ---------- 主流程 ----------
  let _COURTS = null;
  let _TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00"]; // fallback

  async function refreshAll() {
    const dateYMD = elDate?.value || today();
    msgLoad("載入中…");
    msgBook("");

    try {
      // 更新登入狀態（不會拋錯中斷）
      if (typeof window.refreshMe === "function") {
        try { await window.refreshMe(); } catch (_) {}
      }

      // 先抓 courts
      _COURTS = await window.api("/api/courts", { method: "GET" });
      setCourtSelectOptions(_COURTS);

      // ✅ 依 rules 產生時間（不再固定八點）
      _TIMES = await computeTimesFromRules(_COURTS);
      setTimeSelectOptions(_TIMES);

      // ✅ 預設時間改成第一個可選
      if (elTimeSelect && _TIMES.length) {
        // 如果目前值不在新 times 裡，就設成第一個
        const cur = String(elTimeSelect.value || "");
        if (!_TIMES.includes(cur)) elTimeSelect.value = _TIMES[0];
      }

      // 你目前 booking API 是用 date query 抓當日已預約
      const bookings = await window.api(
        `/api/bookings?date=${encodeURIComponent(dateYMD)}`,
        { method: "GET" }
      );
      const bookedMap = buildBookedMap(bookings);

      // ✅ 狀態區塊放到下方
      moveSlotsGridToBottom();

      // ✅ 四個場地一次顯示
      renderSlots(bookedMap, _COURTS, _TIMES);

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
      // ✅ 先算 end_at = start + 1hr（你現在是 60 分鐘 slot）
      const start = new Date(`${dateYMD}T${timeHHMM}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const endHH = String(end.getHours()).padStart(2, "0");
      const endMM = String(end.getMinutes()).padStart(2, "0");

      // ✅ 取得價格顯示（也可交給後端存 price_amount）
      const price = await computePriceForSelection(courtId, dateYMD, timeHHMM);

      const payload = {
        court_id: Number(courtId),
        start_at: `${dateYMD}T${timeHHMM}:00`,
        end_at: `${dateYMD}T${endHH}:${endMM}:00`,
        note: note || null,
        // 若你後端接受 price_amount，就送；不接受也沒關係（多餘欄位可能被忽略）
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

    if (elDate) {
      elDate.setAttribute("type", "date");
      // 你的截圖看起來 date 可能用 2026/01/13，這裡強制改成 YYYY-MM-DD
      if (!elDate.value || elDate.value.includes("/")) elDate.value = today();
      elDate.addEventListener("change", refreshAll);
    }

    // courtSelect change：只要變更，也重新載入（因為 price 會跟 court 相關）
    elCourtSelect?.addEventListener("change", () => {
      // 當場地切換時，若時間目前不在 times，就回到第一個
      if (elTimeSelect && _TIMES.length) {
        const cur = String(elTimeSelect.value || "");
        if (!_TIMES.includes(cur)) elTimeSelect.value = _TIMES[0];
      }
      // 不一定要 refreshAll（會多打 API），但你目前規模小，直接刷新最穩
      refreshAll();
    });

    elBtnBook?.addEventListener("click", doBook);

    // ✅ 初次先把狀態搬到下方
    moveSlotsGridToBottom();

    refreshAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
