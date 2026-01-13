// js/my.js
(function () {
  console.log("my.js loaded OK");

  const $ = (id) => document.getElementById(id);

  function toDatePart(dt) {
    const s = String(dt || "");
    return s.includes("T") ? s.split("T")[0] : s.split(" ")[0];
  }
  function toTimePart(dt) {
    const s = String(dt || "");
    const t = s.includes("T") ? s.split("T")[1] : (s.split(" ")[1] || "");
    return (t || "").slice(0, 5);
  }
  function statusZh(st) {
    const m = { confirmed: "已確認", pending: "待確認", cancelled: "已取消" };
    return m[st] || st || "";
  }
  function money(v) {
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : "";
  }

  function ensureLoggedIn() {
    const t = window.getToken ? window.getToken() : "";
    if (!t) {
      // 你目前登入在 index，這裡簡單導回去
      location.href = "index.html";
      return false;
    }
    $("meName").textContent = t;
    return true;
  }

  async function load() {
    if (!ensureLoggedIn()) return;

    $("msg").textContent = "載入中…";
    $("tbody").innerHTML = "";
    $("sum").textContent = "";

    const date = $("fDate").value.trim();
    const courtId = $("fCourt").value.trim();

    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (courtId) params.set("court_id", courtId);

    try {
      const list = await window.api(`/my/bookings${params.toString() ? "?" + params.toString() : ""}`);

      $("sum").textContent = `共 ${list.length} 筆${date ? `（${date}）` : ""}`;
      if (!list.length) {
        $("msg").textContent = "目前沒有符合條件的未來預約。";
        return;
      }

      const rows = list.map((row) => {
        const d = toDatePart(row.start_at);
        const st = toTimePart(row.start_at);
        const ed = toTimePart(row.end_at);
        const court = row.court_name || (row.court_id === 1 ? "A 場" : row.court_id === 2 ? "B 場" : String(row.court_id));

        return `
          <tr>
            <td>${court}</td>
            <td>${d}</td>
            <td>${st}</td>
            <td>${ed}</td>
            <td>${statusZh(row.status)}</td>
            <td>${money(row.price_amount)}</td>
            <td>
              <button class="btn btn--danger btn--sm" data-cancel="${row.booking_no}">取消</button>
            </td>
          </tr>
        `;
      });

      $("tbody").innerHTML = rows.join("");
      $("msg").textContent = "";

      // bind cancel
      $("tbody").querySelectorAll("[data-cancel]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const bookingNo = btn.getAttribute("data-cancel");
          if (!bookingNo) return;
          if (!confirm("確定要取消這筆預約嗎？")) return;

          btn.disabled = true;
          try {
            await window.api(`/bookings/${bookingNo}/cancel`, { method: "POST" });
            await load();
          } catch (e) {
            alert(String(e.message || e));
          } finally {
            btn.disabled = false;
          }
        });
      });
    } catch (e) {
      $("msg").textContent = `載入失敗：${String(e.message || e)}`;
    }
  }

  $("btnReload").addEventListener("click", load);
  $("btnClear").addEventListener("click", () => {
    $("fDate").value = "";
    load();
  });

  $("btnLogout").addEventListener("click", () => {
    if (window.setToken) window.setToken("");
    location.href = "index.html";
  });

  // 預設日期不強制，留空就是全部未來
  // 如果你希望預設帶今天作為篩選，改成：$("fDate").value = todayLocalYYYYMMDD()
  load();
})();
