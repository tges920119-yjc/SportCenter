// js/common.js
(function () {
  async function api(path, options = {}) {
    const res = await fetch(path, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      let msg = `API ${res.status}`;
      try {
        const data = await res.json();
        msg = data?.detail ? JSON.stringify(data.detail) : (data?.message || msg);
      } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  window.api = api; // booking.js 會用到 window.api
})();
