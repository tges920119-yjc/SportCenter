(() => {
  "use strict";
  console.log("[my.js] loaded OK");

  const $ = (id) => document.getElementById(id);

  const elList = $("myList");
  const elMsg = $("myMsg");
  const elReload = $("btnReloadMy");

  function msg(t = "", isErr = false) {
    if (!elMsg) return;
    elMsg.textContent = t;
    elMsg.classList.toggle("error", !!isErr);
    elMsg.classList.toggle("muted", !isErr);
  }

  function ensureLoginOrPrompt() {
    // 你現在支援 token 與 cookie
    const hasToken = (typeof window.getToken === "function") && !!window.getToken();
    // cookie 無法直接判斷，就靠 refreshMe
    return hasToken;
  }

  function fmtDT(s) {
    const d = new Date(s);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${dd} ${hh}:${mm}`;
  }

  async function fetchCourtsMap() {
    try {
      const courts = await window.api("/api/courts", { method: "GET" });
      const map = new Map();
      for (const c of (courts?.items || [])) map.set(String(c.id), c.name || `Court ${c.id}`);
      return map;
    } catch (e) {
      console.warn("[my.js] fetch courts failed:", e?.message || e);
      return new Map();
    }
  }

  function render(items, courtsMap) {
    if (!elList) return;
    elList.innerHTML = "";

    if (!items || items.length === 0) {
      const d = document.createElement("div");
      d.className = "muted";
      d.textContent = "目前沒有未到時間的預約。";
      elList.appendChild(d);
      return;
    }

    for (const b of items) {
      const courtName = courtsMap.get(String(b.court_id)) || `Court ${b.court_id}`;

      const card = document.createElement("div");
      card.className = "myCard";

      const title = document.createElement("div");
      title.className = "myCard__title";
      title.textContent = `${courtName}｜${fmtDT(b.start_at)} - ${fmtDT(b.end_at)}`;

      const meta = document.createElement("div");
      meta.className = "myCard__meta";
      meta.textContent = `金額：${b.price_amount ?? "-"} ${b.currency ?? "TWD"}　狀態：${b.status ?? "-"}`;

      const note = document.createElement("div");
      note.className = "myCard__note muted";
      note.textContent = b.note ? `備註：${b.note}` : "";

      const actions = document.createElement("div");
      actions.className = "myCard__actions";

      const btnCancel = document.createElement("button");
      btnCancel.className = "btn btn--ghost";
      btnCancel.type = "button";
      btnCancel.textContent = "取消預約";

      btnCancel.addEventListener("click", async () => {
        btnCancel.disabled = true;
        msg("取消中…");
        try {
          await window.api(`/api/bookings/${encodeURIComponent(b.booking_no)}/cancel`, { method: "POST" });
          msg("已取消");
          await refresh();
        } catch (e) {
          console.error(e);
          msg(e?.message || "取消失敗", true);
        } finally {
          btnCancel.disabled = false;
        }
      });

      actions.appendChild(btnCancel);

      card.appendChild(title);
      card.appendChild(meta);
      if (note.textContent) card.appendChild(note);
      card.appendChild(actions);

      elList.appendChild(card);
    }
  }

  async function refresh() {
    if (!elList) return;
    msg("載入中…");

    try {
      // 先刷新登入狀態（會更新右上角）
      if (typeof window.refreshMe === "function") {
        await window.refreshMe(); // 沒登入會回 null，不會炸
      }

      // 抓 courts name map（即使失敗也不影響）
      const courtsMap = await fetchCourtsMap();

      // 抓我的預約（需要登入）
      const resp = await window.api("/api/my/bookings", { method: "GET" });
      render(resp?.items || [], courtsMap);

      msg("");
    } catch (e) {
      console.error(e);

      // 若沒登入，提示打開登入框
      if (String(e?.status) === "401" || /Not logged in/i.test(String(e?.message || ""))) {
        msg("請先登入後查看我的預約。", true);
        document.getElementById("btnLogin")?.click();
        render([], new Map());
        return;
      }

      msg(e?.message || "載入失敗", true);
      render([], new Map());
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    elReload?.addEventListener("click", refresh);
    refresh();
  });
})();
