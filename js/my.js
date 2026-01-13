/* my.js - 我的預約
 * 依賴：common.js 需提供
 * - window.api(path, opts)
 * - window.getToken(), window.setToken()
 * - window.refreshMe()
 * - window.Auth（若你 common.js 有做 modal/登入流程會更完整）
 * - window.todayLocalYYYYMMDD()
 */

console.log("my.js loaded OK", new Date().toISOString());

function $(id) { return document.getElementById(id); }

function courtLabel(courtId) {
  if (String(courtId) === "1") return "A 場";
  if (String(courtId) === "2") return "B 場";
  return String(courtId || "");
}

function fmtDT(s) {
  // s 可能是 "2026-01-12T08:00:00" 或 "2026-01-12 08:00:00"
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

function setMsg(text) {
  const el = $("myMsg");
  if (el) el.textContent = text || "";
}

function setCount(text) {
  const el = $("myCount");
  if (el) el.textContent = text || "";
}

function clearTable() {
  const tb = $("myTbody");
  if (tb) tb.innerHTML = "";
}

function renderRows(rows) {
  const tb = $("myTbody");
  if (!tb) return;

  tb.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08); font-weight:900;">${courtLabel(r.court_id)}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">${fmtDT(r.start_at)}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">${fmtDT(r.end_at)}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08);">${r.status || ""}</td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(15,23,42,.08); font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px;">${r.booking_no || ""}</td>
    `;
    tb.appendChild(tr);
  });
}

async function ensureLoginOrPrompt() {
  // 依你現行流程：token + /api/auth/me
  if (typeof window.refreshMe !== "function") return null;
  const me = await window.refreshMe();

  // 更新 header UI（若 common.js 沒做，這裡補一點）
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

async function loadMyBookings() {
  setMsg("");
  setCount("");
  clearTable();

  const me = await ensureLoginOrPrompt();
  if (!me) {
    setMsg("請先登入後再查看我的預約。");
    return;
  }

  const date = ($("myDate")?.value || "").trim();
  const court = ($("myCourt")?.value || "").trim();

  if (!date) {
    setMsg("請先選擇日期。");
    return;
  }

  try {
    setMsg("載入中…");

    // 後端：GET /api/bookings?date=YYYY-MM-DD&court_id=1(可選)
    const qs = new URLSearchParams();
    qs.set("date", date);
    if (court) qs.set("court_id", court);

    const data = await window.api("/api/bookings?" + qs.toString(), { method: "GET" });
    const items = (data && data.items) ? data.items : [];

    // 只顯示我的
    const mine = items.filter(x => String(x.user_id) === String(me.id));

    renderRows(mine);
    setCount(`共 ${mine.length} 筆（${date}${court ? " / " + courtLabel(court) : ""}）`);
    setMsg(mine.length ? "" : "此日期沒有你的預約。");
  } catch (err) {
    setMsg(err?.message || "載入失敗");
  }
}

function bindUI() {
  // 日期預設為今天（避免 UTC 偏差）
  const d = $("myDate");
  if (d && !d.value) {
    if (typeof window.todayLocalYYYYMMDD === "function") d.value = window.todayLocalYYYYMMDD();
  }

  $("btnReloadMy")?.addEventListener("click", (e) => {
    e.preventDefault();
    loadMyBookings();
  });

  $("myDate")?.addEventListener("change", () => loadMyBookings());
  $("myCourt")?.addEventListener("change", () => loadMyBookings());

  $("btnLogin")?.addEventListener("click", (e) => {
    e.preventDefault();
    // 如果 common.js 有提供開 modal 方法就用它；否則自己開
    const m = $("loginModal");
    if (m) { m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); }
  });

  $("btnLogout")?.addEventListener("click", (e) => {
    e.preventDefault();
    // 依你現行：清 token + refresh
    if (typeof window.setToken === "function") window.setToken("");
    if (typeof window.setUser === "function") window.setUser(null);
    ensureLoginOrPrompt();
    setMsg("已登出。");
    clearTable();
    setCount("");
  });

  // 登入狀態改變時，自動刷新
  window.addEventListener("auth:changed", () => loadMyBookings());
}

document.addEventListener("DOMContentLoaded", async () => {
  bindUI();
  await loadMyBookings();
});
