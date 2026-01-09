// js/booking.js
(() => {
  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  function todayStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function setHint(msg) {
    const el = $("hintArea");
    if (!el) return;
    el.textContent = msg || "";
  }

  // 成功訊息自動消失（錯誤就保留）
  function setHintAutoClear(msg, ms = 2000) {
    setHint(msg);
    if (!msg) return;
    window.clearTimeout(setHintAutoClear._t);
    setHintAutoClear._t = window.setTimeout(() => setHint(""), ms);
  }

  function fmtHHMM(isoStr) {
    // "2026-01-08T08:00:00" -> "08:00"
    if (!isoStr) return "";
    const t = isoStr.split("T")[1] || "";
    return t.slice(0, 5);
  }

  // ---------- API wrappers (common.js 提供 window.api) ----------
  // ⚠️ 注意：common.js 已經會補 /api，所以這裡不要再寫 /api/xxx
  async function getAvailability(courtId, dateStr) {
    const qs = new URLSearchParams({
      court_id: String(courtId),
      date: dateStr,
    });
    return window.api(`/availability?${qs.toString()}`);
  }

  async function createBooking(payload) {
    return window.api(`/bookings`, {
      method: "POST",
      body: payload,
    });
  }

  // ---------- Render grid ----------
  function buildCell({ courtLabel, slot, isAvailable, onBook }) {
    const card = document.createElement("div");
    card.className = "slot";

    const start = fmtHHMM(slot.start_at);
    const end = fmtHHMM(slot.end_at);

    const stateChipClass = isAvailable ? "chip chip--free" : "chip chip--taken";
    const stateText = isAvailable ? "可預約" : "已被租走";

    card.innerHTML = `
      <div class="slot__top">
        <div class="slot__court">Court ${courtLabel}</div>
        <div class="slot__time">${start} - ${end}</div>
      </div>

      <div class="slot__meta">
        <span class="${stateChipClass}">${stateText}</span>
      </div>

      <div class="slot__actions"></div>
    `;

    const actions = card.querySelector(".slot__actions");
    if (isAvailable) {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "預約";
      btn.addEventListener("click", onBook);
      actions.appendChild(btn);
    }

    return card;
  }

  async function renderIndexGrid(dateStr) {
    const grid = $("grid");
    if (!grid) return;

    if (!dateStr) {
      setHint("請先選擇日期");
      grid.innerHTML = "";
      return;
    }

    setHint("載入中...");
    grid.innerHTML = "";

    try {
      const [a, b] = await Promise.all([
        getAvailability(1, dateStr),
        getAvailability(2, dateStr),
      ]);

      if (!a?.ok || !b?.ok) {
        setHint("availability 回傳格式不正確");
        return;
      }

      const groups = [
        { label: "A", court_id: 1, slots: a.slots || [] },
        { label: "B", court_id: 2, slots: b.slots || [] },
      ];

      for (const g of groups) {
        for (const slot of g.slots) {
          const isAvailable = Number(slot.is_available) === 1;

          const cell = buildCell({
            courtLabel: g.label,
            slot,
            isAvailable,
            onBook: async () => {
              try {
                setHint("預約中...");

                // 後端需要：date + start_time
                const startAt = slot.start_at || "";
                const d = startAt.split("T")[0] || "";
                const t = (startAt.split("T")[1] || "").slice(0, 5);

                if (!d || !t) {
                  throw new Error("時間格式不正確，請重新整理頁面");
                }

                await createBooking({
                  court_id: g.court_id,
                  date: d,
                  start_time: t,
                });

                // 成功提示自動消失
                setHintAutoClear("預約成功");
                await renderIndexGrid(dateStr);
              } catch (e) {
                console.error(e);

                // 讓錯誤訊息更人類一點
                let msg = e?.message || "預約失敗";
                if (msg.includes("uq_court_start") || msg.includes("duplicate") || msg.includes("Duplicate")) {
                  msg = "此時段已被預約，請換其他時段";
                }

                alert(msg);
                setHint("預約失敗：" + msg);
              }
            },
          });

          grid.appendChild(cell);
        }
      }

      setHintAutoClear("載入完成", 1200);
    } catch (e) {
      console.error(e);
      setHint("載入失敗：" + (e?.message || e));
    }
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    const datePick = $("datePick");
    if (datePick) {
      // 預設給今天，避免出現空畫面
      if (!datePick.value) datePick.value = todayStr();

      datePick.addEventListener("change", () => {
        renderIndexGrid(datePick.value);
      });

      renderIndexGrid(datePick.value);
    }

    // 可選：健康檢查（不彈窗）
    try {
      await window.api("/health"); // ⚠️ 不要寫 /api/health
    } catch (e) {
      console.warn("API health failed:", e?.message || e);
    }
  });
})();
