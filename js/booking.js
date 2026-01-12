// GitHub Pages version: uses Bearer token (window.Auth.token)
// API Base is defined in index.html (Auth.request uses API_BASE)

const Booking = {
  hours: [8, 9, 10, 11],

  init() {
    this.elDate = document.getElementById("bookingDate");
    this.elCourt = document.getElementById("courtSelect");
    this.elTime = document.getElementById("timeSelect");
    this.elNote = document.getElementById("note");
    this.elBtnBook = document.getElementById("btnBook");
    this.elMsg = document.getElementById("bookingMsg");

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    if (this.elDate) this.elDate.value = `${yyyy}-${mm}-${dd}`;

    this.renderTimes();

    if (this.elBtnBook) this.elBtnBook.addEventListener("click", () => this.handleBook());

    window.addEventListener("auth:changed", () => {
      this.setMsg(window.Auth?.user ? `已登入：${window.Auth.user.display_name}` : "未登入");
    });

    this.setMsg(window.Auth?.user ? `已登入：${window.Auth.user.display_name}` : "未登入");
  },

  setMsg(text) {
    if (this.elMsg) this.elMsg.textContent = text || "";
  },

  renderTimes() {
    if (!this.elTime) return;
    this.elTime.innerHTML = "";
    for (const h of this.hours) {
      const hh = String(h).padStart(2, "0");
      const label = `${hh}:00`;
      const opt = document.createElement("option");
      opt.value = label;
      opt.textContent = label;
      this.elTime.appendChild(opt);
    }
  },

  async handleBook() {
    if (!window.Auth || !window.Auth.user || !window.Auth.token) {
      alert("請先登入才能預約");
      window.Auth?.openModal?.();
      return;
    }

    const dateStr = (this.elDate?.value || "").trim();
    const timeStr = (this.elTime?.value || "").trim(); // "08:00"
    const courtId = Number(this.elCourt?.value || "0");

    if (!dateStr || !timeStr || !courtId) {
      alert("請選擇日期、時間與球場");
      return;
    }

    const [hh, min] = timeStr.split(":").map((x) => Number(x));
    const startAt = `${dateStr} ${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
    const endH = hh + 1;
    const endAt = `${dateStr} ${String(endH).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;

    this.setMsg("送出預約中...");

    try {
      const res = await window.Auth.request("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          court_id: courtId,
          start_at: startAt,
          end_at: endAt
        })
      });

      alert("預約成功");
      this.setMsg(`預約成功：${res.booking_no}`);
    } catch (err) {
      const msg = err?.message || "預約失敗";
      if (msg.includes("Not logged in") || msg.includes("401")) {
        alert("登入已失效，請重新登入");
        window.Auth.logout();
        window.Auth.openModal();
        this.setMsg("未登入");
        return;
      }
      alert(msg);
      this.setMsg("預約失敗");
    }
  }
};

document.addEventListener("DOMContentLoaded", () => Booking.init());
