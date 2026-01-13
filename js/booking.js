/* js/booking.js
 * SportCenter booking page logic
 * - Courts dropdown from API
 * - Availability table auto-follows selected sport group (e.g., 羽球A/B、籃球A/B)
 * - Times auto-generated from court_rules (open_time/close_time/slot_minutes)
 * - Login required to book
 */

console.log("[booking.js] loaded OK");

(function () {
  // --------- DOM helpers ----------
  const $ = (sel) => document.querySelector(sel);

  // Try multiple IDs to match your existing HTML (index.html)
  const elDate =
    $("#date") || $("#bookingDate") || $('input[type="date"]') || $("#dateInput");
  const elCourtSelect =
    $("#courtSelect") || $("#court") || $("#court_id") || $("#selCourt");
  const elTimeSelect =
    $("#startTime") || $("#time") || $("#timeSelect") || $("#selTime");
  const elNote = $("#note") || $("#remark") || $("#memo") || $("#notes");
  const elBtnBook =
    $("#btnBook") || $("#btnConfirm") || $("#btnSubmit") || $("#btnBooking");
  const elLoadMsg = $("#loadMsg") || $("#msg") || $("#message");
  const elSlotsGrid = $("#slotsGrid") || $("#statusGrid") || $("#availGrid");

  // If your status UI uses a specific container, we reuse it.
  // Otherwise we create a simple one inside slotsGrid.
  function ensureSlotsGrid() {
    if (!elSlotsGrid) return null;
    // If already has content structure, keep it.
    return elSlotsGrid;
  }

  // --------- time utils ----------
  function todayLocalYYYYMMDD() {
    // Prefer common.js version if present (you mentioned you already have it)
    if (typeof window.todayLocalYYYYMMDD === "function") {
      return window.todayLocalYYYYMMDD();
    }
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function timeToMinutes(t) {
    const s = String(t || "00:00");
    const parts = s.split(":");
    const hh = Number(parts[0] || 0);
    const mm = Number(parts[1] || 0);
    return hh * 60 + mm;
  }
  function minutesToHHMM(m) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  function pickHHMM(t) {
    // "08:00:00" -> "08:00"
    const s = String(t || "");
    return s.length >= 5 ? s.slice(0, 5) : s;
  }
  function buildTimes(openHHMM, closeHHMM, slotMinutes) {
    const openM = timeToMinutes(openHHMM);
    const closeM = timeToMinutes(closeHHMM);
    const step = Number(slotMinutes || 60);

    const arr = [];
    for (let m = openM; m <= closeM; m += step) {
      arr.push(minutesToHHMM(m));
    }
    return arr;
  }

  // --------- auth / api helpers ----------
  function getToken() {
    if (typeof window.getToken === "function") return window.getToken();
    if (window.api && typeof window.api.getToken === "function")
      return window.api.getToken();
    try {
      return localStorage.getItem("token") || "";
    } catch {
      return "";
    }
  }

  function authHeaders() {
    // Prefer common.js window.api if you have it
    if (window.api && typeof window.api.authHeaders === "function") {
      return window.api.authHeaders();
    }
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function apiBase() {
    return (
      window.API_BASE ||
      (window.api && window.api.base) ||
      "" // allow relative
    );
  }

  async function apiTry(paths, options) {
    const base = apiBase();
    let lastErr = null;

    for (const p of paths) {
      const url = p.startsWith("http") ? p : `${base}${p}`;
      try {
        const r = await fetch(url, options);
        if (r.ok) return r;

        // If not found, try next; otherwise keep last error
        if (r.status === 404) {
          lastErr = new Error(`404 ${url}`);
          continue;
        }
        // non-404 error: still might be correct endpoint but rejected
        const txt = await r.text().catch(() => "");
        throw new Error(`${r.status} ${url} ${txt}`.slice(0, 300));
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("apiTry failed");
  }

  async function apiGetJSON(paths) {
    const r = await apiTry(paths, {
      method: "GET",
      headers: { ...authHeaders() },
    });
    return await r.json();
  }

  async function apiPostJSON(paths, body) {
    const r = await apiTry(paths, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body || {}),
    });
    return await r.json();
  }

  // --------- group logic ----------
  function inferGroupKeyByName(name) {
    const n = String(name || "");
    if (n.includes("籃球")) return "籃球";
    if (n.includes("羽球")) return "羽球";
    // fallback: use first 2 chars as group (or ALL)
    return "ALL";
  }

  function pickGroupCourts(allCourts, selectedId) {
    const items = Array.isArray(allCourts) ? allCourts : [];
    if (items.length === 0) return [];

    const sel =
      items.find((c) => String(c.id) === String(selectedId)) || items[0];
    const key = inferGroupKeyByName(sel?.name);
    const group = items.filter((c) => inferGroupKeyByName(c.name) === key);

    // We display two columns (A/B). If only one exists, duplicate it.
    const c1 = group[0] || items[0];
    const c2 = group[1] || group[0] || items[1] || items[0];
    return [c1, c2];
  }

  // --------- UI helpers ----------
  function setMsg(text) {
    if (!elLoadMsg) return;
    elLoadMsg.textContent = text || "";
  }

  function setTimeSelectOptions(times) {
    if (!elTimeSelect) return;
    elTimeSelect.innerHTML = "";
    (times || []).forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      elTimeSelect.appendChild(opt);
    });
  }

  function setCourtSelectOptions(courtsResp) {
    if (!elCourtSelect) return;
    elCourtSelect.innerHTML = "";

    const items = courtsResp?.items || courtsResp || [];
    if (!Array.isArray(items) || items.length === 0) {
      // fallback (避免誤導，用羽球A/B字樣)
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

    items.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = String(c.id);
      opt.textContent = c.name || `Court ${c.id}`;
      elCourtSelect.appendChild(opt);
    });
  }

  function renderAvailabilityGrid(container, times, courtPair, bookedMap) {
    if (!container) return;

    // bookedMap: { "courtId|HH:MM": true }
    const [c1, c2] = courtPair;

    // Build a simple table layout (if your UI already has a table, you can keep it;
    // this is stable and will overwrite container content).
    container.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "avail";

    const header = document.createElement("div");
    header.className = "avail__header";
    header.innerHTML = `
      <div class="avail__cell avail__cell--h">時間</div>
      <div class="avail__cell avail__cell--h">${c1?.name || "A"}</div>
      <div class="avail__cell avail__cell--h">${c2?.name || "B"}</div>
    `;
    wrap.appendChild(header);

    (times || []).forEach((t) => {
      const row = document.createElement("div");
      row.className = "avail__row";

      const cTime = document.createElement("div");
      cTime.className = "avail__cell avail__cell--time";
      cTime.textContent = t;

      const b1 = document.createElement("button");
      b1.type = "button";
      b1.className = "avail__btn";
      const k1 = `${c1.id}|${t}`;
      const isBooked1 = !!bookedMap[k1];
      b1.textContent = isBooked1 ? "已預約" : "可預約";
      b1.disabled = isBooked1;

      const b2 = document.createElement("button");
      b2.type = "button";
      b2.className = "avail__btn";
      const k2 = `${c2.id}|${t}`;
      const isBooked2 = !!bookedMap[k2];
      b2.textContent = isBooked2 ? "已預約" : "可預約";
      b2.disabled = isBooked2;

      // Click to set select values
      b1.addEventListener("click", () => {
        if (elCourtSelect) elCourtSelect.value = String(c1.id);
        if (elTimeSelect) elTimeSelect.value = t;
        refreshAvailability(); // update grid for selection group (optional)
      });
      b2.addEventListener("click", () => {
        if (elCourtSelect) elCourtSelect.value = String(c2.id);
        if (elTimeSelect) elTimeSelect.value = t;
        refreshAvailability();
      });

      row.appendChild(cTime);
      row.appendChild(b1);
      row.appendChild(b2);
      wrap.appendChild(row);
    });

    container.appendChild(wrap);
  }

  // --------- data fetchers ----------
  async function fetchCourts() {
    // Try common patterns
    return await apiGetJSON([
      "/api/courts",
      "/courts",
      "/api/court",
      "/api/courts/list",
    ]);
  }

  async function fetchCourtRule(courtId) {
    // Try common patterns
    return await apiGetJSON([
      `/api/courts/${encodeURIComponent(courtId)}/rules`,
      `/api/court_rules?court_id=${encodeURIComponent(courtId)}`,
      `/api/court_rules/${encodeURIComponent(courtId)}`,
      `/api/rules?court_id=${encodeURIComponent(courtId)}`,
    ]);
  }

  async function fetchAvailability(dateYYYYMMDD, courtIds) {
    // Expected response formats (any of these):
    // 1) {items:[{court_id,start_time,status}...]}
    // 2) {items:[{court_id,start_at,status}...]}
    // 3) {booked:[{court_id,time:"HH:MM"}...]}
    // We'll normalize into bookedMap.
    const ids = (courtIds || []).map((x) => String(x)).join(",");

    return await apiGetJSON([
      `/api/availability?date=${encodeURIComponent(dateYYYYMMDD)}&court_ids=${encodeURIComponent(
        ids
      )}`,
      `/api/bookings/availability?date=${encodeURIComponent(
        dateYYYYMMDD
      )}&court_ids=${encodeURIComponent(ids)}`,
      `/api/bookings?date=${encodeURIComponent(
        dateYYYYMMDD
      )}&court_ids=${encodeURIComponent(ids)}&status=active`,
      `/api/bookings/list?date=${encodeURIComponent(
        dateYYYYMMDD
      )}&court_ids=${encodeURIComponent(ids)}`,
    ]);
  }

  // --------- main refresh logic ----------
  let _courtsCache = null;
  let _timesCache = null;

  async function refreshTimesBySelectedCourt() {
    // fallback times (if rule API missing)
    let times = ["08:00", "09:00", "10:00", "11:00", "12:00"];

    const selectedId = elCourtSelect ? elCourtSelect.value : "";
    if (!selectedId) {
      _timesCache = times;
      setTimeSelectOptions(times);
      return times;
    }

    try {
      const rule = await fetchCourtRule(selectedId);

      // rule could be a single object or {item:{...}} or {items:[...]}
      const r0 =
        rule?.item ||
        (Array.isArray(rule?.items) ? rule.items[0] : null) ||
        rule;

      const openT = pickHHMM(r0?.open_time || r0?.openTime || "08:00:00");
      const closeT = pickHHMM(r0?.close_time || r0?.closeTime || "12:00:00");
      const slotM = Number(r0?.slot_minutes || r0?.slotMinutes || 60);

      times = buildTimes(openT, closeT, slotM);
    } catch (e) {
      console.warn("[booking.js] fetchCourtRule failed, use fallback TIMES", e);
    }

    _timesCache = times;
    setTimeSelectOptions(times);
    return times;
  }

  function normalizeBookedMap(availResp, times) {
    const booked = {};
    const items = availResp?.items || availResp?.booked || availResp || [];
    if (!Array.isArray(items)) return booked;

    // We treat any item with status booked/active as booked
    for (const it of items) {
      const cid = it.court_id ?? it.courtId ?? it.court ?? it.courtID;
      if (!cid) continue;

      // Support either "start_time" HH:MM or "start_at" datetime
      let hhmm =
        it.time ||
        it.start_time ||
        it.startTime ||
        it.start_hhmm ||
        "";

      if (!hhmm && (it.start_at || it.startAt)) {
        const s = String(it.start_at || it.startAt);
        // Try extract HH:MM from "YYYY-MM-DD HH:MM:SS" or ISO
        const m = s.match(/(\d{2}):(\d{2})/);
        if (m) hhmm = `${m[1]}:${m[2]}`;
      }

      hhmm = pickHHMM(hhmm);
      if (!hhmm) continue;

      const st = String(it.status || "").toLowerCase();
      const isBooked =
        st === "booked" ||
        st === "active" ||
        st === "confirmed" ||
        st === "1" ||
        it.is_booked === 1 ||
        it.is_booked === true;

      // If response doesn't include status, assume it's booked list
      const finalBooked = it.status == null ? true : isBooked;

      if (finalBooked) booked[`${cid}|${hhmm}`] = true;
    }

    // Ensure all displayed times keys exist if needed (not required)
    return booked;
  }

  async function refreshAvailability() {
    const container = ensureSlotsGrid();
    if (!container) return;

    if (!elCourtSelect) return;

    const dateVal = (elDate && elDate.value) || todayLocalYYYYMMDD();
    const selectedId = elCourtSelect.value;

    const courtsItems =
      _courtsCache?.items || _courtsCache || [{ id: 1, name: "羽球A場地" }, { id: 2, name: "羽球B場地" }];

    const pair = pickGroupCourts(courtsItems, selectedId);
    const courtIds = pair.map((c) => c.id);

    // Get times based on selected court's rule
    const times = await refreshTimesBySelectedCourt();

    setMsg("載入可預約狀態中...");
    try {
      const avail = await fetchAvailability(dateVal, courtIds);
      const bookedMap = normalizeBookedMap(avail, times);
      renderAvailabilityGrid(container, times, pair, bookedMap);
      setMsg("");
    } catch (e) {
      console.error(e);
      // Even if availability API fails, show grid as all available
      renderAvailabilityGrid(container, times, pair, {});
      setMsg("⚠️ 無法取得狀態（API 路徑可能不同），已以全部可預約顯示。");
    }
  }

  // --------- booking submit ----------
  function localDatetimeString(dateYYYYMMDD, hhmm) {
    // "2026-01-13" + "08:00" -> "2026-01-13 08:00:00"
    const d = String(dateYYYYMMDD || "");
    const t = String(hhmm || "00:00");
    return `${d} ${t}:00`;
  }

  async function doBooking() {
    const token = getToken();
    if (!token) {
      setMsg("未登入無法預約，請先登入。");
      // If you have login modal + refreshMe, try to open it
      if (typeof window.refreshMe === "function") {
        // refreshMe 通常會更新登入狀態，不一定會開 modal；但至少保持一致
        window.refreshMe();
      }
      return;
    }

    const dateVal = (elDate && elDate.value) || todayLocalYYYYMMDD();
    const courtId = elCourtSelect ? elCourtSelect.value : "";
    const hhmm = elTimeSelect ? elTimeSelect.value : "";
    const note = elNote ? elNote.value : "";

    if (!courtId || !hhmm) {
      setMsg("請選擇場地與開始時間。");
      return;
    }

    const startAt = localDatetimeString(dateVal, hhmm);

    // You may have different API paths; we try several.
    const payload = {
      court_id: Number(courtId),
      start_at: startAt,
      note: note,
    };

    setMsg("送出預約中...");
    try {
      const resp = await apiPostJSON(
        ["/api/bookings", "/api/bookings/create", "/api/booking", "/bookings"],
        payload
      );
      console.log("booking resp", resp);
      setMsg("✅ 預約成功");
      await refreshAvailability();
    } catch (e) {
      console.error(e);
      setMsg("❌ 預約失敗：可能已被預約或 API 路徑不一致。");
      await refreshAvailability();
    }
  }

  // --------- init ----------
  async function init() {
    try {
      // Ensure date input is type=date and set to local today (avoid UTC)
      if (elDate) {
        elDate.setAttribute("type", "date");
        if (!elDate.value) elDate.value = todayLocalYYYYMMDD();
      }

      // Load courts
      setMsg("載入場地中...");
      try {
        _courtsCache = await fetchCourts();
      } catch (e) {
        console.warn("[booking.js] fetchCourts failed, use fallback", e);
        _courtsCache = {
          items: [
            { id: 1, name: "羽球A場地" },
            { id: 2, name: "羽球B場地" },
          ],
        };
      }

      setCourtSelectOptions(_courtsCache);

      // If you want default to first option
      if (elCourtSelect && !elCourtSelect.value) {
        const first = (_courtsCache?.items || _courtsCache || [])[0];
        if (first) elCourtSelect.value = String(first.id);
      }

      // Bind events
      if (elCourtSelect) elCourtSelect.addEventListener("change", refreshAvailability);
      if (elDate) elDate.addEventListener("change", refreshAvailability);
      if (elBtnBook) elBtnBook.addEventListener("click", doBooking);

      // Render initial
      setMsg("");
      await refreshAvailability();
    } catch (e) {
      console.error(e);
      setMsg("初始化失敗，請檢查 console。");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
