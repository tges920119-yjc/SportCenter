(() => {
  "use strict";
  console.log("[my.js] loaded OK");

  const $ = (id) => document.getElementById(id);
  const elMsg = $("myMsg");
  const elList = $("myList");
  const elReload = $("btnReloadMy");

  function msg(t = "", isErr = false) {
    if (!elMsg) return;
    elMsg.textContent = t;
    elMsg.classList.toggle("error", isErr);
    elMsg.classList.toggle("muted", !isErr);
  }

  function ensureLogin() {
    const token = (typeof window.getToken === "function") ? window.getToken() : "";
    if (token) return true;
    msg("請先登入後再查看我的預約", true);
    $("btnLogin")?.click();
    return false;
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

  function render(items) {
    elList.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "目前沒有可顯示的預約。";
      elList.appendChild(empty);
      return;
    }

    for (const b of items) {
      const card = document.createElement("div");
      card.className = "myCard";

      const title = document.createElement("div");
      title.className = "myCard__title";
      title.textContent = `${b.court_name || ("Court " + b.court_id)}｜${fmtDT(b.start_at)} - ${fmtDT(b.end_at)}`;

      const meta = document.createElement("div");
      meta.className = "myCard__meta";
      meta.textContent = `金額：${b.price_amount ?? "-"} ${b.currency ?? "TWD"}　狀態：${b.status ?? "active"}`;

      const note = document.createElement("div");
      note.className = "myCard__note muted";
      note.textContent = b.note ? `備註：${b.note}` : "";

      const actions = document.createElement("div");
      actions.className = "myCard__actions";

      const btnCancel = document.createElement("button");
      btnCancel.className = "btn btn--ghost";
      btnCancel.type = "button";
      btnCancel.textContent = "取消預約";
      btnCancel.onclick = async () => {
        if (!ensureLogin()) return;
        btnCancel.disabled = true;
        try {
          // 你後端若是 PUT/PATCH/POST cancel，這裡改成你實際 API
          await window.api(`/api/bookings/${encodeURIComponent(b.booking_no || b.id)}/cancel`, { method: "POST" });
          msg("已取消預約");
          await refresh();
        } catch (e) {
          console.error(e);
          msg(e?.message || "取消失敗（後端 cancel API 尚未接好）", true);
        } finally {
          btnCancel.disabled = false;
        }
      };

      actions.appendChild(btnCancel);

      card.appendChild(title);
      card.appendChild(meta);
      if (note.textContent) card.appendChild(note);
      card.appendChild(actions);

      elList.appendChild(card);
    }
  }

  async function refresh() {
    if (!ensureLogin()) return;

    msg("載入中…");
    try {
      if (typeof window.refreshMe === "function") {
        try { await window.refreshMe(); } catch (_) {}
      }

      // ✅ 先嘗試「我的預約」專用 API
      let resp;
      try {
        resp = await window.api("/api/my/bookings", { method: "GET" });
      } catch (_) {
        // fallback：後端還沒做
        resp = null;
      }

      if (!resp || !Array.isArray(resp.items)) {
        msg("後端尚未提供 /api/my/bookings（我的預約）API，請先把後端接好。", true);
        render([]);
        return;
      }

      render(resp.items);
      msg("");
    } catch (e) {
      console.error(e);
      msg(e?.message || "載入失敗", true);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    elReload?.addEventListener("click", refresh);
    refresh();
  });
})();
