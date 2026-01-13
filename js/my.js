console.log("my.js loaded OK", new Date().toISOString());
function $(id) { return document.getElementById(id); }

function courtLabel(courtId) {
  if (String(courtId) === "1") return "A 場";
  if (String(courtId) === "2") return "B 場";
  return String(courtId || "");
}

function statusZh(st) {
  const m = { confirmed: "已確認", pending: "待確認", cancelled: "已取消" };
  return m[st] || (st || "");
}

function toParts(dt) {
  // dt 可能是 "2026-01-13 12:00:00" 或 ISO
  const s = String(dt || "").replace(" ", "T");
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");
    return { date: `${yyyy}-${mm}-${dd}`, time: `${HH}:${MM}` };
  }
  // fallback：用字串拆
  const raw = String(dt || "");
  const [datePart, timePart] = raw.split(" ");
  return { date: datePart || "", time: (timePart || "").slice(0,5) };
}

function setMsg(text) { const el = $("myMsg"); if (el) el.textContent = text || ""; }
function setCount(text) { const el = $("myCount"); if (el) el.textContent = text || ""; }

async function ensureLoginUI() {
  const me = (typeof window.refreshMe === "function") ? await window.refreshMe() : null;

  const navUserName = $("navUserName");
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");

  if (me) {
    if (navUserName) navUserName.textContent = me.display_name || "";
    if (btnLogin) btnLogin.hidden = true;
    if (btnLogout) btnLogout.hidden = false;
  } else {
    if (navUserName) navUserName.textContent = "";
    if (btnLogin) btnLogin.hidden = false;
    if (btnLogout) btnLogout.hidden = true;
  }
  return me;
}

function renderRows(items) {
  const tb = $("myTbody");
  if (!tb) return;
  tb.innerHTML = "";

  items.forEach(r => {
    const st = toParts(r.start_at);
    const ed = toParts(r.end_at);

    const price = (r.price_amount != null)
      ? `${r.price_amount} ${r.currency || ""}`.trim()
      : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08); font-weight:900;">${courtLabel(r.court_id)}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">${st.date}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">${st.time}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">${ed.time}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">${statusZh(r.status)}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">${price}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">
        <button class="btn btn--ghost btnCancel" type="button" data-bno="${r.booking_no || ""}">
          取消
        </button>
      </td>
    `;
    tb.appendChild(tr);
  });

  tb.querySelectorAll(".btnCancel").forEach(btn => {
    btn.addEventListener("click", async () => {
      const bno = btn.getAttribute("data-bno");
      if (!bno) return;
      if (!confirm("確定要取消這筆預約？")) return;

      try {
        btn.disabled = true;
        await window.api(`/api/bookings/${encodeURIComponent(bno)}/cancel`, { method: "POST" });
        setMsg("已取消。");
        await loadMyBookings();
      } catch (err) {
        alert(err?.message || "取消失敗");
        btn.disabled = false;
      }
    });
  });
}

async function loadMyBookings() {
  setMsg("");
  setCount("");

  const me = await ensureLoginUI();
  if (!me) {
    setMsg("請先登入後再查看我的預約（需要 token）。");
    const tb = $("myTbody"); if (tb) tb.innerHTML = "";
    return;
  }

  const date = ($("myDate")?.value || "").trim();
  const court = ($("myCourt")?.value || "").trim();

  try {
    setMsg("載入中…");

    const qs = new URLSearchParams();
    if (court) qs.set("court_id", court);
    if (date) qs.set("date", date);

    const url = "/api/my/bookings" + (qs.toString() ? "?" + qs.toString() : "");
    const data = await window.api(url, { method: "GET" });
    const items = (data && data.items) ? data.items : [];

    renderRows(items);

    const label = [
      "未來未取消",
      date ? `日期=${date}` : "",
      court ? courtLabel(court) : ""
    ].filter(Boolean).join(" / ");

    setCount(`共 ${items.length} 筆（${label}）`);
    setMsg(items.length ? "" : "目前沒有未來預約。");
  } catch (err) {
    setMsg(err?.message || "載入失敗");
  }
}

function bindUI() {
  // 預設日期留空（顯示全部未來）
  const d = $("myDate");
  if (d) d.value = "";

  $("btnReloadMy")?.addEventListener("click", (e) => { e.preventDefault(); loadMyBookings(); });

  $("btnClearDate")?.addEventListener("click", (e) => {
    e.preventDefault();
    if ($("myDate")) $("myDate").value = "";
    loadMyBookings();
  });

  $("myDate")?.addEventListener("change", () => loadMyBookings());
  $("myCourt")?.addEventListener("change", () => loadMyBookings());

  // 這裡不重做你 index 的登入流程，只做登出（保持相容）
  $("btnLogout")?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (typeof window.setToken === "function") window.setToken("");
    if (typeof window.setUser === "function") window.setUser(null);
    await ensureLoginUI();
    setMsg("已登出。");
    const tb = $("myTbody"); if (tb) tb.innerHTML = "";
    setCount("");
  });

  window.addEventListener("auth:changed", () => loadMyBookings());
}

document.addEventListener("DOMContentLoaded", async () => {
  bindUI();
  await loadMyBookings();
});
