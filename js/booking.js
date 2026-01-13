// js/booking.js
(function () {
  console.log("booking.js loaded OK");

  const $ = (id) => document.getElementById(id);

  const TIMES = ["08:00", "09:00", "10:00", "11:00"]; // 08-12 四個小時格

  function ymdhm(ymd, hm) {
    return `${ymd} ${hm}`;
  }

  function addHour(hm) {
    const [h, m] = hm.split(":").map(Number);
    const hh = String(h + 1).padStart(2, "0");
    return `${hh}:${String(m).padStart(2, "0")}`;
  }

  function requireLogin() {
    const t = window.getToken();
    if (t) return true;
    window.openModal("loginModal");
    return false;
  }

  async function doBook(startHm) {
    if (!requireLogin()) return;

    const ymd = $("dateInput").value;
    const courtId = Number($("courtSelect").value || 0);
    const endHm = addHour(startHm);

    const payload = {
      court_id: courtId,
      start_at: ymdhm(ymd, startHm),
      end_at: ymdhm(ymd, endHm),
    };

    $("loadMsg").textContent = "送出預約中…";

    try {
      const r = await window.api("/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      $("loadMsg").textContent = `✅ 預約成功：${r.start_at} - ${r.end_at}，金額 ${r.price_amount ?? ""}`;
      renderSlots(); // 重新渲染（讓使用者感覺有更新）
    } catch (e) {
      const msg = String(e.message || e);

      if (msg.includes("already booked") || msg.includes("已")) {
        $("loadMsg").textContent = "❌ 此時段已被預約";
      } else if (msg.includes("Not logged in") || msg.includes("401")) {
        $("loadMsg").textContent = "❌ 請先登入";
        window.openModal("loginModal");
      } else {
        $("loadMsg").textContent = `❌ 預約失敗：${msg}`;
      }
    }
  }

  function renderSlots() {
    const grid = $("slotsGrid");
    if (!grid) return;

    const ymd = $("dateInput").value;
    const courtId = $("courtSelect").value;

    grid.innerHTML = TIMES.map((t) => {
      const end = addHour(t);
      return `
        <div class="slotCard">
          <div class="slotCard__time">${ymd}　${t} - ${end}</div>
          <div class="slotCard__meta muted">球場：${courtId === "1" ? "A" : "B"}</div>
          <div class="slotCard__actions">
            <button class="btn btn--sm" data-book="${t}">預約</button>
          </div>
        </div>
      `;
    }).join("");

    grid.querySelectorAll("[data-book]").forEach((btn) => {
      btn.addEventListener("click", () => doBook(btn.getAttribute("data-book")));
    });

    $("loadMsg").textContent = "請選擇時段後按預約。";
  }

  function bindLoginModal() {
    const modal = $("loginModal");
    const panel = $("loginPanel");
    const btnLogin = $("btnLogin");
    const btnClose = $("btnCloseLogin");
    const btnDo = $("btnDoLogin");
    const btnLogout = $("btnLogout");

    if (btnLogin) btnLogin.addEventListener("click", () => window.openModal("loginModal"));
    if (btnClose) btnClose.addEventListener("click", () => window.closeModal("loginModal"));

    // 點遮罩關閉、點 panel 不關
    if (modal && panel) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) window.closeModal("loginModal");
      });
      panel.addEventListener("click", (e) => e.stopPropagation());
    }

    if (btnDo) {
      btnDo.addEventListener("click", async () => {
        const name = ($("loginName").value || "").trim();
        if (!name) {
          alert("請輸入帳號（display_name）");
          return;
        }
        window.setToken(name);
        window.closeModal("loginModal");
        await window.refreshMe();
        $("loadMsg").textContent = `已登入：${name}`;
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener("click", async () => {
        window.setToken("");
        await window.refreshMe();
        $("loadMsg").textContent = "已登出";
      });
    }
  }

  function init() {
    // 日期預設今天（避免 UTC 偏差）
    const d = $("dateInput");
    if (d) {
      d.type = "date";
      if (!d.value) d.value = window.todayLocalYYYYMMDD();
    }

    $("btnReloadSlots")?.addEventListener("click", renderSlots);
    $("courtSelect")?.addEventListener("change", renderSlots);
    $("dateInput")?.addEventListener("change", renderSlots);

    bindLoginModal();
    window.refreshMe();
    renderSlots();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
