// booking.js - Phase 1 (test): fixed slots 08:00-12:00, 1 hour per slot
// requires js/common.js: api(), refreshMe(), setToken(), setUser()

function pad2(n){ return String(n).padStart(2,"0"); }
console.log("booking.js loaded OK", new Date().toISOString());

let CURRENT_USER = null;

const HOURS = [8, 9, 10, 11]; // 08-12 (start hours)
const SLOT_MINUTES = 60;

async function loadUser() {
  CURRENT_USER = await refreshMe();
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  if (CURRENT_USER) {
    if (btnLogin) btnLogin.hidden = true;
    if (btnLogout) btnLogout.hidden = false;
  } else {
    if (btnLogin) btnLogin.hidden = false;
    if (btnLogout) btnLogout.hidden = true;
  }
  return CURRENT_USER;
}

async function loadCourts() {
  const r = await api("/api/courts", { method: "GET" });
  return r.items || [];
}

async function loadBooked(dateStr, courtId) {
  const r = await api(`/api/bookings?date=${encodeURIComponent(dateStr)}&court_id=${encodeURIComponent(courtId)}`, { method: "GET" });
  return r.items || [];
}

async function createBooking(courtId, startAt, endAt) {
  return await api("/api/bookings", {
    method: "POST",
    body: JSON.stringify({ court_id: courtId, start_at: startAt, end_at: endAt })
  });
}

function normalizeBookedSet(bookedRows){
  // 用 start_at -> "HH:MM" 建 set
  const used = new Set();
  for (const b of bookedRows) {
    const s = String(b.start_at);
    // ISO: 2026-01-10T08:00:00
    let m = s.match(/T(\d{2}):(\d{2})/);
    if (m) { used.add(`${m[1]}:${m[2]}`); continue; }
    // SQL string: 2026-01-10 08:00:00
    m = s.match(/ (\d{2}):(\d{2})/);
    if (m) { used.add(`${m[1]}:${m[2]}`); continue; }
  }
  return used;
}

function buildSlots(usedSet){
  return HOURS.map(h => {
    const hh = pad2(h);
    const key = `${hh}:00`;
    return { time: key, available: !usedSet.has(key) };
  });
}

function setMsg(txt){
  const el = document.getElementById("loadMsg");
  if (el) el.textContent = txt || "";
}

async function render() {
  const dateEl = document.getElementById("bookingDate");
  const courtEl = document.getElementById("courtSelect");
  const gridEl = document.getElementById("slotsGrid");

  const dateStr = (dateEl?.value || "").trim();
  const courtId = Number(courtEl?.value || "0");

  if (!dateStr || !courtId) return;

  try {
    setMsg("讀取中...");
    const booked = await loadBooked(dateStr, courtId);
    const used = normalizeBookedSet(booked);
    const slots = buildSlots(used);

    if (gridEl) {
      gridEl.innerHTML = "";
      for (const s of slots) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot-btn " + (s.available ? "ok" : "full");
        btn.textContent = s.available ? `可預約 ${s.time}` : `已被租走 ${s.time}`;
        btn.disabled = !s.available;

        btn.addEventListener("click", async () => {
          if (!CURRENT_USER) {
            alert("請先登入才能預約");
            return;
          }
          const startAt = `${dateStr} ${s.time}:00`;
          const endH = Number(s.time.slice(0,2)) + 1;
          const endAt = `${dateStr} ${pad2(endH)}:00:00`;

          try {
            setMsg("送出預約中...");
            const r = await createBooking(courtId, startAt, endAt);
            alert("預約成功：" + r.booking_no);
            await render();
          } catch (e) {
            alert(e.message || "預約失敗");
            await render();
          }
        });

        gridEl.appendChild(btn);
      }
    }
    setMsg("");
  } catch (e) {
    setMsg("載入失敗：" + (e.message || "Not Found"));
  }
}

async function init() {
  await loadUser();

  // courts 下拉
  const dateEl = document.getElementById("datePick"); // 你實際的 id 可能不同
  if (dateEl && !dateEl.value) dateEl.value = todayLocalYYYYMMDD();
  try {
    const courts = await loadCourts();
    if (courtEl) {
      courtEl.innerHTML = "";
      for (const c of courts) {
        const opt = document.createElement("option");
        opt.value = String(c.id);
        opt.textContent = c.name;
        courtEl.appendChild(opt);
      }
    }
  } catch (e) {
    setMsg("載入失敗：" + (e.message || "Not Found"));
  }

  // 綁定
  document.getElementById("bookingDate")?.addEventListener("change", render);
  document.getElementById("courtSelect")?.addEventListener("change", render);

  // 登出
  document.getElementById("btnLogout")?.addEventListener("click", () => {
    setToken("");
    setUser(null);
    CURRENT_USER = null;
    alert("已登出");
    render();
  });

  await render();
}

document.addEventListener("DOMContentLoaded", init);
