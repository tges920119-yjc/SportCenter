// js/booking.js
(function () {
  console.log("booking.js loaded OK");

  const $ = (id) => document.getElementById(id);

  // 你 index.html 必須有：
  // - date input: id="bookDate"
  // - court select: id="courtId" (value 1/2)
  // - start select: id="startTime" (例如 08:00)
  // - end select: id="endTime" (例如 09:00)
  // - book button: id="btnBook"
  // - message: id="loadMsg"
  //
  // 如果你的 id 不一樣，把這些改成你自己的即可。

  function ensureLoggedInOrHint() {
    const t = window.getToken ? window.getToken() : "";
    if (!t) {
      alert("請先登入後再預約。");
      return false;
    }
    return true;
  }

  function ymdhm(dateStr, hmStr) {
    // "2026-01-13" + "12:00" -> "2026-01-13 12:00"
    return `${dateStr} ${hmStr}`;
  }

  async function doBook() {
    if (!ensureLoggedInOrHint()) return;

    const date = ($("bookDate") && $("bookDate").value) || "";
    const courtId = Number(($("courtId") && $("courtId").value) || 0);
    const start = ($("startTime") && $("startTime").value) || "";
    const end = ($("endTime") && $("endTime").value) || "";

    if (!date || !courtId || !start || !end) {
      alert("請完整選擇 日期/球場/開始/結束");
      return;
    }

    const payload = {
      court_id: courtId,
      start_at: ymdhm(date, start),
      end_at: ymdhm(date, end),
    };

    $("loadMsg") && ($("loadMsg").textContent = "送出預約中…");

    try {
      const r = await window.api("/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      $("loadMsg") && ($("loadMsg").textContent = "預約成功！");
      alert(`預約成功：${r.court_name || r.court_id} ${r.start_at} - ${r.end_at} 金額 ${r.price_amount || ""}`);
    } catch (e) {
      $("loadMsg") && ($("loadMsg").textContent = "");
      alert(`預約失敗：${String(e.message || e)}`);
    }
  }

  function init() {
    // 確保 date input 是本地日期（避免 UTC 偏差）
    const d = $("bookDate");
    if (d) {
      d.type = "date";
      if (!d.value) d.value = window.todayLocalYYYYMMDD ? window.todayLocalYYYYMMDD() : "";
    }

    const btn = $("btnBook");
    if (btn) btn.addEventListener("click", doBook);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
