// js/common.js
const API_BASE = "";

async function api(path, options = {}) {
  const opts = Object.assign({ method: "GET", headers: {} }, options);

  if (opts.body && typeof opts.body === "object") {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }

  const r = await fetch(API_BASE + path, opts);
  const text = await r.text();

  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!r.ok) throw new Error(data?.detail || text || `HTTP ${r.status}`);
  return data;
}

// 讓 booking.js / HTML onclick 都能用到
window.API_BASE = API_BASE;
window.api = api;