// booking.js (GitHub Pages) - read courts & booked slots from DB, create booking (login required)

function pad2(n){ return String(n).padStart(2,"0"); }
function ymd(d){
  const yyyy=d.getFullYear();
  const mm=pad2(d.getMonth()+1);
  const dd=pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

let CURRENT_USER = null;

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

// 你目前的時段：08-12，每次 1 小時
const HOURS = [8,9,10,11];

function buildSlots(bookedRows) {
  // 用 start_at 來標記已佔用
  const used = new Set();
  for (const b of bookedRows) {
    const s = String(b.start_at); // 可能是 "2026-01-10 08:00:00" 或 ISO
    // 統一抓出 HH:00
    const m = s.match(/T(\d{2}):(\d{2})/);
    if (m) used.add(`${m[1]}:${m[2]}`);
    else {
      const m2 = s.match(/ (\d{2}):(\d{2})/);
      if (m2) used.add(`${m2[1]}:${m2[2]}`);
    }
  }
  return HOURS.map(h => {
    const hh = pad2(h);
    const key = `${hh}:00`;
    return { time: key, available: !used.has(key) };
  });
}

async function render() {
  const dateEl = document.getElementById("bookingDate");
  const courtEl = document.getElementById("courtSelect");
  const gridEl = document.getElementById("slotsGrid");
  const msgEl = document.getElementById("loadMsg");

  try {
    if (msgEl) msgEl.textContent = "讀取中...";
    const dateStr = (dateEl?.value || "").trim();

    const courtId = Number(courtEl?.value || "1");
    const booked = await loadBooked(dateStr, courtId);
    const slots = buildSlots(booked);

    // 畫面渲染按鈕
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
            const r = await createBooking(courtId, startAt, endAt);
            alert("預約成功：" + r.booking_no);
            await render(); // 重新刷新
          } catch (e) {
            if (e.status === 409) alert("該時段已被預約");
            else alert(e.message || "預約失敗");
            await render();
          }
        });

        gridEl.appendChild(btn);
      }
    }
    if (msgEl) msgEl.textContent = "";
  } catch (e) {
    if (msgEl) msgEl.textContent = "載入失敗：" + (e.message || "Not Found");
  }
}

async function init() {
  // 預設日期今天
  const dateEl = document.getElementById("bookingDate");
  if (dateEl && !dateEl.value) dateEl.value = ymd(new Date());

  // 先讀使用者狀態
  await loadUser();

  // 讀 courts 填下拉
  const courtEl = document.getElementById("courtSelect");
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
    // courts 失敗會影響顯示
  }

  // 監聽日期/球場變更
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
