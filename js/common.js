// === 正式 API（Cloudflare Tunnel）===
const API_BASE = "https://api.novrise.org";

// 共用 fetch 封裝
async function api(path, options = {}) {
  const opts = Object.assign({ method: "GET", headers: {} }, options);

  // 自動 JSON body
  if (opts.body && typeof opts.body === "object") {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }

  const r = await fetch(API_BASE + path, opts);

  // 盡量把錯誤訊息讀出來
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!r.ok) {
    throw new Error(data?.detail || text || `HTTP ${r.status}`);
  }
  return data;
}
