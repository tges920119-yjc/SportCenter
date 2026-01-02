// ===============================
// Front-end only demo logic
// - Login modal (localStorage)
// - Slot availability rendering (08:00-12:00, 1 hour)
// - Booking create/cancel stored in localStorage
// - Logged out: can see free/taken, but no "my bookings" list
// ===============================

(function () {
  const STORAGE_USER = "cb_demo_user";
  const STORAGE_BOOKINGS = "cb_demo_bookings";

  // Courts fixed per your requirement
  const COURTS = [
    { id: 1, name: "A" },
    { id: 2, name: "B" },
  ];

  // Slots fixed: 08-12, 1 hour (4 slots)
  const SLOT_STARTS = ["08:00", "09:00", "10:00", "11:00"];
  const SLOT_ENDS   = ["09:00", "10:00", "11:00", "12:00"];
  const PRICE_PER_SLOT = 250;

  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function pad2(n){ return String(n).padStart(2,"0"); }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(STORAGE_USER) || "null"); }
    catch { return null; }
  }

  function setUser(user) {
    localStorage.setItem(STORAGE_USER, JSON.stringify(user));
  }

  function clearUser() {
    localStorage.removeItem(STORAGE_USER);
  }

  function getBookings() {
    try { return JSON.parse(localStorage.getItem(STORAGE_BOOKINGS) || "[]"); }
    catch { return []; }
  }

  function setBookings(items) {
    localStorage.setItem(STORAGE_BOOKINGS, JSON.stringify(items));
  }

  // booking record:
  // { id, userName, date, courtId, start, end, amount, createdAt }
  function makeId() {
    return "B" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  }

  function isTaken(bookings, date, courtId, start) {
    return bookings.some(b => b.date === date && b.courtId === courtId && b.start === start);
  }

  function findBooking(bookings, date, courtId, start) {
    return bookings.find(b => b.date === date && b.courtId === courtId && b.start === start) || null;
  }

  function upsertHint(msg) {
    const hint = $("#hintArea");
    if (hint) hint.textContent = msg || "";
  }

  // ---------- UI: login modal ----------
  function openModal() {
    const m = $("#loginModal");
    if (!m) return;
    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    const name = $("#loginName");
    if (name) name.focus();
  }

  function closeModal() {
    const m = $("#loginModal");
    if (!m) return;
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
  }

  function bindModal() {
    const modal = $("#loginModal");
    if (!modal) return;

    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "1") {
        closeModal();
      }
    });

    const btnDoLogin = $("#btnDoLogin");
    if (btnDoLogin) {
      btnDoLogin.addEventListener("click", () => {
        const name = ($("#loginName")?.value || "").trim();
        const pass = ($("#loginPass")?.value || "").trim();
        if (!name) {
          alert("請輸入顯示名稱");
          return;
        }
        // Demo: password not validated now
        setUser({ name, passSet: !!pass });
        closeModal();
        syncAuthUI();
        rerenderAll();
      });
    }
  }

  function syncAuthUI() {
    const user = getUser();
    const btnLogin = $("#btnLogin");
    const btnLogout = $("#btnLogout");
    const badge = $("#userBadge");
    const userName = $("#userName");
    const navMy = $("#navMy");
    const mineLegend = $("#mineLegend");

    if (user) {
      if (btnLogin) btnLogin.hidden = true;
      if (btnLogout) btnLogout.hidden = false;
      if (badge) badge.hidden = false;
      if (userName) userName.textContent = user.name;
      if (navMy) navMy.classList.remove("is-disabled");
      if (mineLegend) mineLegend.hidden = false;
    } else {
      if (btnLogin) btnLogin.hidden = false;
      if (btnLogout) btnLogout.hidden = true;
      if (badge) badge.hidden = true;
      if (mineLegend) mineLegend.hidden = true;
      // 如果在 my.html 未登入：提示並留在頁面
      if (navMy) {
        // nothing
      }
    }
  }

  function bindTopButtons() {
    const btnLogin = $("#btnLogin");
    const btnLogout = $("#btnLogout");

    if (btnLogin) btnLogin.addEventListener("click", openModal);

    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        clearUser();
        syncAuthUI();
        rerenderAll();
      });
    }
  }

  // ---------- UI: reveal animation ----------
  function bindReveal() {
    const els = $$(".reveal");
    if (!els.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.08 });

    els.forEach(el => io.observe(el));
  }

  // ---------- Booking page rendering (index.html) ----------
  function renderGrid() {
    const grid = $("#grid");
    if (!grid) return;

    const user = getUser();
    const date = $("#datePick")?.value || todayISO();
    const bookings = getBookings();

    // Header row
    const cells = [];
    cells.push(cell("場地 / 時段", "cell cell--head"));
    for (let i = 0; i < SLOT_STARTS.length; i++) {
      cells.push(cell(`${SLOT_STARTS[i]}-${SLOT_ENDS[i]}`, "cell cell--head"));
    }

    // Rows: A, B
    for (const c of COURTS) {
      cells.push(cell(`場地 ${c.name}`, "cell cell--rowhead"));
      for (let i = 0; i < SLOT_STARTS.length; i++) {
        const start = SLOT_STARTS[i];
        const end = SLOT_ENDS[i];

        const existing = findBooking(bookings, date, c.id, start);
        const taken = !!existing;
        const mine = taken && user && existing.userName === user.name;

        const cls = [
          "cell",
          taken ? "is-taken" : "is-free"
        ].join(" ");

        const badgeCls = [
          "badge",
          mine ? "badge--mine" : (taken ? "badge--taken" : "badge--free")
        ].join(" ");

        // logged out: can see free/taken only; cannot book
        // logged in: can book if free; can cancel if mine
        let right = "";
        if (!taken) {
          right = `<span class="${badgeCls}">可預約</span>`;
        } else if (mine) {
          right = `<span class="${badgeCls}">我的預約</span>`;
        } else {
          right = `<span class="${badgeCls}">已被租走</span>`;
        }

        const btnHtml = (() => {
          if (!user) {
            return "";
          }
          if (!taken) {
            return `<button class="btn btn--ghost js-book"
                      data-date="${date}" data-court="${c.id}"
                      data-start="${start}" data-end="${end}">
                      預約
                    </button>`;
          }
          if (mine) {
            return `<button class="btn btn--ghost js-cancel"
                      data-id="${existing.id}">
                      取消
                    </button>`;
          }
          return "";
        })();

        const html = `
          <div class="${cls}">
            <div>
              <div style="font-weight:900">${taken ? (mine ? "已預約" : "不可用") : "可租借"}</div>
              <div style="color:rgba(255,255,255,0.65);font-size:12px">${taken ? "" : `TWD ${PRICE_PER_SLOT}`}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;justify-content:flex-end">
              ${right}
              ${btnHtml}
            </div>
          </div>
        `;
        cells.push(html);
      }
    }

    grid.innerHTML = cells.join("");

    // Hint
    if (!user) {
      upsertHint("目前未登入：你可以查看可預約/已被租走的時段；登入後才能進行預約與查看「我的預約」。");
    } else {
      upsertHint("已登入：可直接預約空時段；取消自己的預約會立即釋放該時段。");
    }

    bindGridActions();
  }

  function cell(text, cls) {
    return `<div class="${cls}">${text}</div>`;
  }

  function bindGridActions() {
    const user = getUser();
    if (!user) return;

    $$(".js-book").forEach(btn => {
      btn.addEventListener("click", () => {
        const date = btn.getAttribute("data-date");
        const courtId = Number(btn.getAttribute("data-court"));
        const start = btn.getAttribute("data-start");
        const end = btn.getAttribute("data-end");

        const bookings = getBookings();

        if (isTaken(bookings, date, courtId, start)) {
          alert("這個時段已被預約（已刷新）");
          renderGrid();
          return;
        }

        const courtName = COURTS.find(c => c.id === courtId)?.name || "?";
        const ok = confirm(
          `確認預約？\n日期：${date}\n場地：${courtName}\n時段：${start}-${end}\n費用：TWD ${PRICE_PER_SLOT}`
        );
        if (!ok) return;

        bookings.push({
          id: makeId(),
          userName: user.name,
          date,
          courtId,
          start,
          end,
          amount: PRICE_PER_SLOT,
          createdAt: new Date().toISOString()
        });

        setBookings(bookings);
        renderGrid(); // 立即反映（釋放/佔用都是靠這張表）
      });
    });

    $$(".js-cancel").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const ok = confirm("確認取消？取消後會立即釋放該時段。");
        if (!ok) return;

        const bookings = getBookings().filter(b => b.id !== id);
        setBookings(bookings);
        renderGrid();
      });
    });
  }

  // ---------- My bookings page rendering (my.html) ----------
  function renderMyPage() {
    const table = $("#myTable");
    const hint = $("#myHint");
    if (!table || !hint) return;

    const user = getUser();
    if (!user) {
      hint.textContent = "你尚未登入，無法查看我的預約。請先按右上角「登入」。";
      table.innerHTML = "";
      return;
    }

    const bookings = getBookings()
      .filter(b => b.userName === user.name)
      .sort((a,b) => (a.date + a.start).localeCompare(b.date + b.start));

    if (!bookings.length) {
      hint.textContent = "目前沒有任何預約。回到「預約」頁面建立一筆吧。";
      table.innerHTML = "";
      return;
    }

    hint.textContent = `共 ${bookings.length} 筆預約（取消會立即釋放時段）。`;

    table.innerHTML = bookings.map(b => {
      const courtName = COURTS.find(c => c.id === b.courtId)?.name || "?";
      return `
        <div class="rowcard">
          <div class="rowcard__left">
            <div class="rowcard__title">日期 ${b.date}｜場地 ${courtName}｜${b.start}-${b.end}</div>
            <div class="rowcard__sub">費用：TWD ${b.amount}</div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <span class="badge badge--mine">我的預約</span>
            <button class="btn btn--ghost js-cancel-my" data-id="${b.id}">取消</button>
          </div>
        </div>
      `;
    }).join("");

    $$(".js-cancel-my").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const ok = confirm("確認取消？取消後會立即釋放該時段。");
        if (!ok) return;

        const bookings2 = getBookings().filter(x => x.id !== id);
        setBookings(bookings2);
        renderMyPage();
      });
    });
  }

  // ---------- Shared ----------
  function rerenderAll() {
    // index.html
    if ($("#grid")) renderGrid();
    // my.html
    if ($("#myTable")) renderMyPage();
  }

  function initDatePick() {
    const d = $("#datePick");
    if (!d) return;
    d.value = todayISO();
    d.addEventListener("change", () => renderGrid());
  }

  // ---------- Boot ----------
  syncAuthUI();
  bindTopButtons();
  bindModal();
  bindReveal();
  initDatePick();
  rerenderAll();

})();
