// index.html 已經有：#datePick #grid #hintArea
const elDate = document.getElementById("datePick");
const elGrid = document.getElementById("grid");
const elHint = document.getElementById("hintArea");

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function setHint(msg) {
  elHint.textContent = msg || "";
}

// 先用固定時段（你先前設定 08-12）
const SLOTS = ["08:00", "09:00", "10:00", "11:00"];
// 先用固定場地（之後可改成後端回傳）
const COURTS = [
  { id: 1, name: "A" },
  { id: 2, name: "B" },
];

// 把 YYYY-MM-DD + HH:MM 組成 ISO（本地時間）
function toISO(dateStr, hhmm) {
  return `${dateStr}T${hhmm}:00`;
}

// === 你的後端 API ===
async function fetchAvailability(dateStr) {
  return api(`/api/availability?date=${encodeURIComponent(dateStr)}`);
}

async function postBooking(courtId, startAtISO) {
  return api(`/api/bookings`, {
    method: "POST",
    body: { court_id: courtId, start_at: startAtISO },
  });
}

// 先渲染基本格子（之後再套真實 booked 狀態）
function renderGrid(dateStr, availabilityData) {
  // 目前先把 JSON 放到提示區，方便你我對齊欄位
  setHint(`availability raw: ${JSON.stringify(availabilityData)}`);

  elGrid.innerHTML = "";

  for (const c of COURTS) {
    for (const t of SLOTS) {
      const startISO = toISO(dateStr, t);

      const card = document.createElement("div");
      card.className = "cell"; // 你的 CSS 如果不是 cell，告訴我我幫你對齊

      // 先預設都可預約
      card.innerHTML = `
        <div class="cell__top">
          <div class="cell__court">Court ${c.name}</div>
          <div class="cell__time">${t}</div>
        </div>
        <button class="btn btn--sm cell__btn">預約</button>
      `;

      const btn = card.querySelector("button");
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "處理中…";
        try {
          await postBooking(c.id, startISO);
          await load(); // 成功後重抓
        } catch (e) {
          alert(e.message);
          btn.disabled = false;
          btn.textContent = "預約";
        }
      });

      elGrid.appendChild(card);
    }
  }
}

async function load() {
  const dateStr = elDate.value || todayStr();
  elDate.value = dateStr;

  setHint("載入中...");
  try {
    const data = await fetchAvailability(dateStr);
    renderGrid(dateStr, data);
    setHint("載入完成（已顯示 availability raw 方便對欄位）");
  } catch (e) {
    setHint(`載入失敗：${e.message}`);
  }
}

// 日期變更就重新載入
elDate.addEventListener("change", load);

// 初始化
elDate.value = todayStr();
load();
