// js/booking.js
(() => {
  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const API_BASE = "/api";

  function todayStr() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function setHint(msg) {
    const el = $("hintArea");
    if (el) el.textContent = msg || "";
  }

  // ---------- API wrappers ----------
  async function getAvailability(courtId, dateStr) {
    const qs = new URLSearchParams({
      court_id: String(courtId),
      date: dateStr,
    });
    return window.api(`${API_BASE}/availability?${qs.toString()}`);
  }

  async function listBookings() {
    return window.api(`${API_BASE}/bookings`);
  }

  async function createBooking(payload) {
    return window.api(`${API_BASE}/bookings`, {
      method: "POST",
      body: payload,
    });
  }

  async function cancelBooking(bookingId) {
    return window.api(
      `${API_BASE}/bookings/${encodeURIComponent(bookingId)}/cancel`,
      { method: "POST" }
    );
  }

  // ---------- UI helpers ----------
  function fmtHHMM(isoStr) {
    if (!isoStr) return "";
    return isoStr.split("T")[1].slice(0, 5);
  }

  function buildCell({ courtLabel, slot, isAvailable, onBook }) {
    const card = document.createElement("div");
    card.className = "slot";

    const start = fmtHHMM(slot.start_at);
    const end = fmtHHMM(slot.end_at);

    card.innerHTML = `
      <div class="slot__top">
        <div class="slot__court">Court ${courtLabel}</div>
        <div class="slot__time">${start} - ${end}</div>
      </div>
      <div class="slot__meta">
        <span class="chip ${
          isAvailable ? "chip--free" : "chip--taken"
        }">
          ${isAvailable ? "可預約" : "已被租走"}
        </span>
      </div>
      <div class="slot__actions"></div>
    `;

    if (isAvailable) {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "預約";
      btn.onclick = onBook;
      card.querySelector(".slot__actions").appendChild(btn);
    }

    return card;
  }

  function normalizeAvail(x) {
    if (!x) return { ok: false, slots: [] };
    return {
      ok: x.ok ?? true,
      slots: x.slots || [],
    };
  }

  // ---------- main render ----------
  async function renderIndexGrid(dateStr) {
    const grid = $("grid");
    if (!grid) return;

    setHint("載入中...");
    grid.innerHTML = "";

    try {
      const [a, b] = await Promise.all([
        getAvailability(1, dateStr),
        getAvailability(2, dateStr),
      ]);

      const A = normalizeAvail(a);
      const B = normalizeAvail(b);
      if (!A.ok || !B.ok) {
        setHint("資料格式錯誤");
        return;
      }

      const groups = [
        { label: "A", court_id: 1, slots: A.slots },
        { label: "B", court_id: 2, slots: B.slots },
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
                await createBooking({
                  court_id: g.court_id,
                  start_at: slot.start_at,
                });
                setHint("預約成功，重新載入...");
                await renderIndexGrid(dateStr);
              } catch (e) {
                alert(e.message);
                setHint("預約失敗：" + e.message);
              }
            },
          });
          grid.appendChild(cell);
        }
      }

      setHint("載入完成");
    } catch (e) {
      console.error(e);
      setHint("載入失敗：" + e.message);
    }
  }

  // ---------- raw helpers (venues / my) ----------
  window.loadAvailability = async () => {
    const dateStr = $("datePick")?.value || todayStr();
    const [a, b] = await Promise.all([
      getAvailability(1, dateStr),
      getAvailability(2, dateStr),
    ]);
    $("out").textContent = JSON.stringify({ A: a, B: b }, null, 2);
  };

  window.loadMyBookings = async () => {
    const data = await listBookings();
    $("out").textContent = JSON.stringify(data, null, 2);
  };

  window.cancelBooking = cancelBooking;

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    const datePick = $("datePick");
    if (datePick) {
      datePick.value ||= todayStr();
      datePick.onchange = () => renderIndexGrid(datePick.value);
      renderIndexGrid(datePick.value);
    }

    // health check（靜默）
    try {
      await window.api("/api/health");
    } catch (e) {
      console.warn("API health failed:", e.message);
    }
  });
})();
