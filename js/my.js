console.log("my.js loaded OK", new Date().toISOString());
function $(id) { return document.getElementById(id); }

function courtLabel(courtId) {
  if (String(courtId) === "1") return "A 場";
  if (String(courtId) === "2") return "B 場";
  return String(courtId || "");
}

function fmtDT(s) {
  if (!s) return "";
  const t = String(s).replace(" ", "T");
  const d = new Date(t);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${HH}:${MM}`;
  }
  return String(s);
}

function setMsg(text) { const el = $("myMsg"); if (el) el.textContent = text || ""; }
function setCount(text) { const el = $("myCount"); if (el) el.textContent = text || ""; }

async function ensureLogin() {
  if (typeof window.refreshMe !== "function") return null;
  const me = await window.refreshMe();

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

function renderRows(rows) {
  const tb = $("myTbody");
  if (!tb) return;
  tb.innerHTML = "";

  rows.forEach(r => {
    const tr = document.createElement("tr");
    const price = (r.price_amount != null) ? `${r.price_amount} ${r.currency || ""}`.trim() : "";

    tr.innerHTML = `
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08); font-weight:900;">${courtLabel(r.court_id)}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">${fmtDT(r.start_at)}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">${fmtDT(r.end_at)}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">${r.status || ""}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">${price}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08); font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px;">${r.booking_no || ""}</td>
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

  const me = await ensureLogin();
  if (!me) {
    setMsg("請先登入後再查看我的預約。");
    const tb = $("myTbody"); if (tb) tb.innerHTML = "";
    setCount("");
    return;
  }

  const date = ($("myDate")?.value || "").trim();   // 可空：不篩選日期
  const court = ($("myCourt")?.value || "").trim(); // 可空：不篩選球場

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

  $("btnLogin")?.addEventListener("click", (e) => {
    e.preventDefault();
    const m = $("loginModal");
    if (m) { m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); }
  });

  $("btnLogout")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (typeof window.setToken === "function") window.setToken("");
    if (typeof window.setUser === "function") window.setUser(null);
    ensureLogin();
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
