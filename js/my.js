// js/my.js
(() => {
  const $ = (id) => document.getElementById(id);
  const API_BASE = "/api";

  function setHint(msg) {
    const el = $("hintArea");
    if (el) el.textContent = msg || "";
  }

  function fmtDate(iso) {
    // "2026-01-08T08:00:00" -> "2026-01-08"
    if (!iso) return "";
    return iso.split("T")[0];
  }

  function fmtHHMM(iso) {
    if (!iso) return "";
    const t = iso.split("T")[1] || "";
    return t.slice(0, 5);
  }

  function courtLabelFromId(id) {
    if (Number(id) === 1) return "A";
    if (Number(id) === 2) return "B";
    return String(id ?? "");
  }

  function statusText(row) {
    // 依你的後端回傳欄位做容錯
    // 常見：status: "active"/"cancelled" 或 is_cancelled: 0/1 或 cancelled_at 有值
    const s = (row?.status || "").toLowerCase();
    if (s === "cancelled" || s === "canceled") return "已取消";
    if (row?.is_cancelled === 1) return "已取消";
    if (row?.cancelled_at) return "已取消";
    return "已預約";
  }

  function canCancel(row) {
    const s = (row?.status || "").toLowerCase();
    if (s === "cancelled" || s === "canceled") return false;
    if (row?.is_cancelled === 1) return false;
    if (row?.cancelled_at) return false;
    return true;
  }

  async function listBookings() {
    return window.api(`${API_BASE}/bookings`);
  }

  async function cancelBooking(bookingId) {
    return window.api(`${API_BASE}/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: "POST",
    });
  }

  function pickBookingId(row) {
    // 你的後端可能叫 booking_no / id / booking_id
    return row?.booking_no || row?.booking_id || row?.id || "";
  }

  function renderRows(rows) {
    const tbody = $("tbodyBookings");
    const empty = $("emptyState");
    const table = $("tblBookings");

    if (!tbody) return;

    const list =
    Array.isArray(rows) ? rows :
    Array.isArray(rows?.items) ? rows.items :
    Array.isArray(rows?.data) ? rows.data :
    Array.isArray(rows?.bookings) ? rows.bookings :
    Array.isArray(rows?.rows) ? rows.rows :
    [];
    tbody.innerHTML = "";

    if (!list || list.length === 0) {
      if (empty) empty.hidden = false;
      if (table) table.style.display = "none";
      return;
    }

    if (empty) empty.hidden = true;
    if (table) table.style.display = "";

    for (const row of list) {
      const tr = document.createElement("tr");

      const courtId = row?.court_id ?? row?.courtId;
      const startAt = row?.start_at ?? row?.startAt;
      const endAt = row?.end_at ?? row?.endAt;

      const bookingId = pickBookingId(row);
      const st = statusText(row);
      const cancellable = canCancel(row);

      tr.innerHTML = `
        <td>Court ${courtLabelFromId(courtId)}</td>
        <td>${fmtDate(startAt)}</td>
        <td>${fmtHHMM(startAt)} - ${fmtHHMM(endAt)}</td>
        <td>${st}</td>
        <td></td>
      `;

      const tdAction = tr.querySelector("td:last-child");

      if (cancellable && bookingId) {
        const btn = document.createElement("button");
        btn.className = "btn btn--ghost";
        btn.textContent = "取消";
        btn.onclick = async () => {
          if (!confirm("確定要取消這筆預約？")) return;
          try {
            btn.disabled = true;
            setHint("取消中...");
            await cancelBooking(bookingId);
            setHint("已取消，重新整理...");
            await load();
          } catch (e) {
            alert(e.message);
            setHint("取消失敗：" + e.message);
          } finally {
            btn.disabled = false;
          }
        };
        tdAction.appendChild(btn);
      } else {
        tdAction.textContent = "-";
      }

      tbody.appendChild(tr);
    }
  }

  async function load() {
    setHint("載入中...");
    try {
      const data = await listBookings();
      renderRows(data);
      setHint("載入完成");
    } catch (e) {
      console.error(e);
      setHint("載入失敗：" + e.message);
      // 失敗時也顯示空狀態，避免畫面空白
      renderRows([]);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("btnReload")?.addEventListener("click", load);
    load();
  });
})();
